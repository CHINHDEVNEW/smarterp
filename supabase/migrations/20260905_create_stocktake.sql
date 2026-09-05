-- Tạo phiếu kiểm kê và cân đối tồn kho trong cùng một transaction.
-- Chạy file này một lần trong Supabase SQL Editor trước khi hoàn tất phiếu kiểm kê.

create or replace function public.create_stocktake(
  p_business_id uuid,
  p_stocktake jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_item jsonb;
  v_header jsonb;
  v_item_payload jsonb;
  v_columns text;
  v_values text;
  v_stocktake_id uuid;
  v_product_id uuid;
  v_actual numeric;
  v_system numeric;
  v_difference numeric;
  v_difference_value numeric;
  v_total_difference numeric := 0;
  v_total_difference_value numeric := 0;
  v_total_items integer := 0;
  v_stocktake_date date;
  v_code text;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập để tạo phiếu kiểm kê.';
  end if;

  if not exists (
    select 1
    from public.business_members
    where business_id = p_business_id
      and user_id = auth.uid()
      and active = true
  ) then
    raise exception 'Bạn không có quyền tạo phiếu kiểm kê cho doanh nghiệp này.';
  end if;

  if p_items is null or coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Phiếu kiểm kê phải có ít nhất một sản phẩm.';
  end if;

  if (
    select count(*) from jsonb_array_elements(p_items)
  ) <> (
    select count(distinct nullif(element->>'product_id', ''))
    from jsonb_array_elements(p_items) as elements(element)
  ) then
    raise exception 'Mỗi sản phẩm chỉ được xuất hiện một lần trong phiếu kiểm kê.';
  end if;

  v_stocktake_date := coalesce(
    nullif(p_stocktake->>'stocktake_date', ''),
    nullif(p_stocktake->>'date', ''),
    current_date::text
  )::date;
  v_note := nullif(coalesce(p_stocktake->>'note', p_stocktake->>'reason', ''), '');
  v_code := 'KK-' || to_char(v_stocktake_date, 'YYMM') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  -- Khóa toàn bộ sản phẩm được kiểm kê trước khi tính chênh lệch.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_actual := coalesce(
      nullif(v_item->>'actual_quantity', '')::numeric,
      nullif(v_item->>'counted_quantity', '')::numeric,
      nullif(v_item->>'actual_stock', '')::numeric
    );

    if v_product_id is null or v_actual is null or v_actual < 0 then
      raise exception 'Sản phẩm hoặc số lượng thực tế không hợp lệ.';
    end if;

    select * into v_product
    from public.products
    where id = v_product_id
      and business_id = p_business_id
      and active = true
    for update;

    if not found then
      raise exception 'Có sản phẩm không tồn tại hoặc đã ngừng kinh doanh.';
    end if;
    if lower(coalesce(v_product.product_type::text, '')) = 'service' then
      raise exception 'Dịch vụ không thể đưa vào phiếu kiểm kê tồn kho.';
    end if;

    v_system := coalesce(v_product.stock_on_hand, 0);
    v_difference := v_actual - v_system;
    v_difference_value := round(v_difference * coalesce(v_product.cost_price, 0), 2);
    v_total_items := v_total_items + 1;
    v_total_difference := v_total_difference + v_difference;
    v_total_difference_value := v_total_difference_value + v_difference_value;
  end loop;

  v_header := jsonb_build_object(
    'id', gen_random_uuid(),
    'business_id', p_business_id,
    'code', v_code,
    'stocktake_code', v_code,
    'stocktake_number', v_code,
    'stocktake_date', v_stocktake_date,
    'date', v_stocktake_date,
    'document_date', v_stocktake_date,
    'status', 'completed',
    'stocktake_status', 'completed',
    'state', 'completed',
    'total_items', v_total_items,
    'item_count', v_total_items,
    'total_products', v_total_items,
    'total_difference_quantity', round(v_total_difference, 3),
    'difference_quantity', round(v_total_difference, 3),
    'total_difference', round(v_total_difference, 3),
    'total_difference_value', round(v_total_difference_value, 2),
    'difference_value', round(v_total_difference_value, 2),
    'total_adjustment_value', round(v_total_difference_value, 2),
    'note', v_note,
    'reason', v_note,
    'created_by', auth.uid(),
    'created_at', now(),
    'updated_at', now()
  );

  select
    string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
    string_agg(format('r.%I', c.column_name), ', ' order by c.ordinal_position)
  into v_columns, v_values
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'stocktakes'
    and c.is_generated = 'NEVER'
    and v_header ? c.column_name;

  if v_columns is null then
    raise exception 'Bảng stocktakes chưa có cột phù hợp để lưu phiếu kiểm kê.';
  end if;

  execute format(
    'insert into public.stocktakes (%s) select %s from jsonb_populate_record(null::public.stocktakes, $1) r returning id',
    v_columns,
    v_values
  ) using v_header into v_stocktake_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_actual := coalesce(
      nullif(v_item->>'actual_quantity', '')::numeric,
      nullif(v_item->>'counted_quantity', '')::numeric,
      nullif(v_item->>'actual_stock', '')::numeric
    );

    select * into v_product
    from public.products
    where id = v_product_id
      and business_id = p_business_id;

    v_system := coalesce(v_product.stock_on_hand, 0);
    v_difference := v_actual - v_system;
    v_difference_value := round(v_difference * coalesce(v_product.cost_price, 0), 2);
    v_item_payload := jsonb_build_object(
      'id', gen_random_uuid(),
      'business_id', p_business_id,
      'stocktake_id', v_stocktake_id,
      'check_id', v_stocktake_id,
      'inventory_check_id', v_stocktake_id,
      'product_id', v_product_id,
      'product_code', v_product.code,
      'product_name', v_product.name,
      'name', v_product.name,
      'unit', v_product.unit,
    'system_quantity', v_system,
    'book_quantity', v_system,
    'expected_quantity', v_system,
      'system_stock', v_system,
      'book_stock', v_system,
      'expected_stock', v_system,
    'quantity_before', v_system,
    'actual_quantity', v_actual,
    'counted_quantity', v_actual,
    'counted_stock', v_actual,
    'actual_stock', v_actual,
      'actual', v_actual,
      'counted', v_actual,
      'quantity', v_actual,
    'quantity_after', v_actual,
    'difference', v_difference,
    'difference_quantity', v_difference,
    'quantity_difference', v_difference,
      'stock_difference', v_difference,
      'adjustment_quantity', v_difference,
      'unit_cost', coalesce(v_product.cost_price, 0),
      'cost_price', coalesce(v_product.cost_price, 0),
      'difference_value', v_difference_value,
      'value_difference', v_difference_value,
      'note', nullif(v_item->>'note', ''),
      'reason', nullif(v_item->>'reason', ''),
      'created_at', now(),
      'updated_at', now()
    );

    select
      string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
      string_agg(format('r.%I', c.column_name), ', ' order by c.ordinal_position)
    into v_columns, v_values
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'stocktake_items'
      and c.is_generated = 'NEVER'
      and v_item_payload ? c.column_name;

    if v_columns is null then
      raise exception 'Bảng stocktake_items chưa có cột phù hợp để lưu chi tiết.';
    end if;

    execute format(
      'insert into public.stocktake_items (%s) select %s from jsonb_populate_record(null::public.stocktake_items, $1)',
      v_columns,
      v_values
    ) using v_item_payload;

    if v_difference <> 0 then
      insert into public.stock_movements (
        business_id, product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, note, created_by
      ) values (
        p_business_id, v_product_id, 'adjustment', v_difference, coalesce(v_product.cost_price, 0),
        'stocktake', v_stocktake_id, 'Cân đối theo phiếu kiểm kê ' || v_code, auth.uid()
      );
    end if;
  end loop;

  return jsonb_build_object(
    'id', v_stocktake_id,
    'code', v_code,
    'total_items', v_total_items,
    'total_difference_quantity', round(v_total_difference, 3),
    'total_difference_value', round(v_total_difference_value, 2)
  );
end;
$$;

grant execute on function public.create_stocktake(uuid, jsonb, jsonb) to authenticated;

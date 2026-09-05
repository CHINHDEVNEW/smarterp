-- Tạo phiếu trả hàng bán/nhập theo một transaction:
-- lưu phiếu, lưu chi tiết, cập nhật sổ kho và hoàn/nhận tiền nếu chọn.
-- Chạy file này một lần trong Supabase SQL Editor trước khi tạo phiếu trả hàng.

create or replace function public.create_sales_return(
  p_business_id uuid,
  p_return jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order public.sales_orders%rowtype;
  v_order_item public.sales_order_items%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_header jsonb;
  v_item_payload jsonb;
  v_columns text;
  v_values text;
  v_order_id uuid;
  v_return_id uuid;
  v_customer_name text;
  v_product_id uuid;
  v_quantity numeric;
  v_returned numeric;
  v_unit_price numeric;
  v_unit_cost numeric;
  v_line_total numeric;
  v_total numeric := 0;
  v_refund numeric;
  v_refund_now boolean := false;
  v_account_id uuid;
  v_code text;
  v_transaction public.finance_transactions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập để tạo phiếu trả hàng.';
  end if;

  if not exists (
    select 1
    from public.business_members
    where business_id = p_business_id
      and user_id = auth.uid()
      and active = true
  ) then
    raise exception 'Bạn không có quyền tạo phiếu trả hàng cho doanh nghiệp này.';
  end if;

  if p_items is null or coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Phiếu trả hàng phải có ít nhất một sản phẩm.';
  end if;

  v_order_id := nullif(coalesce(p_return->>'sales_order_id', p_return->>'order_id'), '')::uuid;
  if v_order_id is null then
    raise exception 'Chưa chọn đơn bán cần trả.';
  end if;

  select * into v_order
  from public.sales_orders
  where id = v_order_id
    and business_id = p_business_id
  for update;

  if not found or lower(coalesce(v_order.status, '')) in ('cancelled', 'canceled', 'draft') then
    raise exception 'Đơn bán không hợp lệ để tạo phiếu trả hàng.';
  end if;

  select c.name into v_customer_name
  from public.customers c
  where c.id = v_order.customer_id
    and c.business_id = p_business_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, nullif(v_item->>'return_quantity', '')::numeric, 0);

    if v_product_id is null or v_quantity <= 0 then
      raise exception 'Sản phẩm hoặc số lượng trả không hợp lệ.';
    end if;

    select * into v_order_item
    from public.sales_order_items
    where business_id = p_business_id
      and sales_order_id = v_order_id
      and product_id = v_product_id
    order by id
    limit 1
    for update;

    if not found then
      raise exception 'Sản phẩm trả không thuộc đơn bán đã chọn.';
    end if;

    select coalesce(sum(sri.quantity), 0)
    into v_returned
    from public.sales_return_items sri
    join public.sales_returns sr on sr.id = sri.sales_return_id
    where sri.business_id = p_business_id
      and sri.product_id = v_product_id
      and sr.sales_order_id = v_order_id
      and lower(coalesce(sr.status, 'completed')) not in ('cancelled', 'canceled', 'draft');

    if v_quantity > greatest(0, v_order_item.quantity - v_returned) then
      raise exception 'Số lượng trả vượt quá số lượng còn có thể trả của sản phẩm.';
    end if;

    v_unit_price := coalesce(v_order_item.unit_price, 0);
    v_unit_cost := coalesce(v_order_item.unit_cost, v_unit_price, 0);
    v_line_total := round(v_quantity * v_unit_price, 2);
    v_total := v_total + v_line_total;
  end loop;

  v_refund := coalesce(nullif(p_return->>'refund_amount', '')::numeric, v_total);
  if v_refund < 0 or v_refund > v_total then
    raise exception 'Số tiền hoàn không hợp lệ.';
  end if;
  v_refund := round(v_refund, 2);
  v_refund_now := coalesce((p_return->>'refund_now')::boolean, false);
  v_account_id := nullif(p_return->>'account_id', '')::uuid;

  if v_refund_now and v_refund > 0 and v_account_id is null then
    raise exception 'Cần chọn tài khoản chi hoàn tiền.';
  end if;

  if v_refund_now and v_refund > 0 and not exists (
    select 1
    from public.finance_accounts
    where id = v_account_id
      and business_id = p_business_id
      and active = true
  ) then
    raise exception 'Tài khoản hoàn tiền không hợp lệ.';
  end if;

  v_code := 'THB-' || to_char(current_date, 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_header := jsonb_build_object(
    'id', gen_random_uuid(),
    'business_id', p_business_id,
    'code', v_code,
    'return_code', v_code,
    'return_number', v_code,
    'return_date', coalesce(nullif(p_return->>'return_date', ''), current_date::text),
    'returned_at', now(),
    'document_date', coalesce(nullif(p_return->>'return_date', ''), current_date::text),
    'sales_order_id', v_order.id,
    'order_id', v_order.id,
    'customer_id', v_order.customer_id,
    'customer_name', v_customer_name,
    'customer', v_customer_name,
    'total', v_total,
    'total_amount', v_total,
    'amount', v_total,
    'return_amount', v_total,
    'refund_amount', v_refund,
    'refund_now', v_refund_now,
    'refund_status', case when v_refund_now and v_refund > 0 then 'refunded' else 'pending' end,
    'status', 'completed',
    'return_status', 'completed',
    'state', 'completed',
    'return_type', 'sales',
    'reason', nullif(p_return->>'reason', ''),
    'note', nullif(p_return->>'note', ''),
    'account_id', v_account_id,
    'refund_account_id', v_account_id,
    'payment_method', nullif(p_return->>'payment_method', ''),
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
    and c.table_name = 'sales_returns'
    and c.is_generated = 'NEVER'
    and v_header ? c.column_name;

  if v_columns is null then
    raise exception 'Bảng sales_returns chưa có cột phù hợp để lưu phiếu trả hàng.';
  end if;

  execute format(
    'insert into public.sales_returns (%s) select %s from jsonb_populate_record(null::public.sales_returns, $1) r returning id',
    v_columns,
    v_values
  ) using v_header into v_return_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, nullif(v_item->>'return_quantity', '')::numeric, 0);

    select * into v_order_item
    from public.sales_order_items
    where business_id = p_business_id
      and sales_order_id = v_order_id
      and product_id = v_product_id
    order by id
    limit 1;

    select * into v_product
    from public.products
    where id = v_product_id
      and business_id = p_business_id;

    v_unit_price := coalesce(v_order_item.unit_price, 0);
    v_unit_cost := coalesce(v_order_item.unit_cost, v_unit_price, v_product.cost_price, 0);
    v_line_total := round(v_quantity * v_unit_price, 2);
    v_item_payload := jsonb_build_object(
      'id', gen_random_uuid(),
      'business_id', p_business_id,
      'sales_return_id', v_return_id,
      'return_id', v_return_id,
      'sales_order_id', v_order_id,
      'sales_order_item_id', v_order_item.id,
      'product_id', v_product_id,
      'product_code', v_product.code,
      'product_name', v_product.name,
      'unit', v_product.unit,
      'quantity', v_quantity,
      'return_quantity', v_quantity,
      'unit_price', v_unit_price,
      'unit_cost', v_unit_cost,
      'line_total', v_line_total,
      'total', v_line_total,
      'note', nullif(v_item->>'note', ''),
      'created_at', now(),
      'updated_at', now()
    );

    select
      string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
      string_agg(format('r.%I', c.column_name), ', ' order by c.ordinal_position)
    into v_columns, v_values
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'sales_return_items'
      and c.is_generated = 'NEVER'
      and v_item_payload ? c.column_name;

    if v_columns is null then
      raise exception 'Bảng sales_return_items chưa có cột phù hợp để lưu chi tiết.';
    end if;

    execute format(
      'insert into public.sales_return_items (%s) select %s from jsonb_populate_record(null::public.sales_return_items, $1)',
      v_columns,
      v_values
    ) using v_item_payload;

    if v_product.product_type <> 'service' then
      insert into public.stock_movements (
        business_id, product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, note, created_by
      ) values (
        p_business_id, v_product_id, 'return', v_quantity, v_unit_cost,
        'sales_return', v_return_id, 'Nhập lại theo phiếu trả hàng ' || v_code, auth.uid()
      );
    end if;
  end loop;

  if v_refund_now and v_refund > 0 then
    insert into public.finance_transactions (
      business_id, transaction_date, direction, category, account_id, amount,
      payment_method, reference_type, reference_id, note, status, created_by
    ) values (
      p_business_id, current_date, 'out', 'Hoàn tiền trả hàng', v_account_id, v_refund,
      coalesce(nullif(p_return->>'payment_method', ''), 'cash'), 'sales_return', v_return_id,
      nullif(p_return->>'note', ''), 'posted', auth.uid()
    ) returning * into v_transaction;

    insert into public.payment_allocations (
      business_id, transaction_id, document_type, document_id, amount
    ) values (
      p_business_id, v_transaction.id, 'sales_order', v_order_id, v_refund
    );
  end if;

  return jsonb_build_object('id', v_return_id, 'code', v_code, 'total', v_total, 'refund_amount', v_refund);
end;
$$;

grant execute on function public.create_sales_return(uuid, jsonb, jsonb) to authenticated;

create or replace function public.create_purchase_return(
  p_business_id uuid,
  p_return jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_order_item public.purchase_order_items%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_header jsonb;
  v_item_payload jsonb;
  v_columns text;
  v_values text;
  v_order_id uuid;
  v_return_id uuid;
  v_supplier_name text;
  v_product_id uuid;
  v_quantity numeric;
  v_returned numeric;
  v_unit_cost numeric;
  v_line_total numeric;
  v_total numeric := 0;
  v_refund numeric;
  v_refund_now boolean := false;
  v_account_id uuid;
  v_allow_negative_stock boolean := false;
  v_code text;
  v_transaction public.finance_transactions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập để tạo phiếu trả hàng.';
  end if;

  if not exists (
    select 1
    from public.business_members
    where business_id = p_business_id
      and user_id = auth.uid()
      and active = true
  ) then
    raise exception 'Bạn không có quyền tạo phiếu trả hàng cho doanh nghiệp này.';
  end if;

  if p_items is null or coalesce(jsonb_typeof(p_items), '') <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Phiếu trả hàng phải có ít nhất một sản phẩm.';
  end if;

  v_order_id := nullif(coalesce(p_return->>'purchase_order_id', p_return->>'order_id'), '')::uuid;
  if v_order_id is null then
    raise exception 'Chưa chọn phiếu nhập cần trả.';
  end if;

  select * into v_order
  from public.purchase_orders
  where id = v_order_id
    and business_id = p_business_id
  for update;

  if not found or lower(coalesce(v_order.status, '')) in ('cancelled', 'canceled', 'draft') then
    raise exception 'Phiếu nhập không hợp lệ để tạo phiếu trả hàng.';
  end if;

  select s.name into v_supplier_name
  from public.suppliers s
  where s.id = v_order.supplier_id
    and s.business_id = p_business_id;

  select coalesce(allow_negative_stock, false)
  into v_allow_negative_stock
  from public.app_settings
  where business_id = p_business_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, nullif(v_item->>'return_quantity', '')::numeric, 0);

    if v_product_id is null or v_quantity <= 0 then
      raise exception 'Sản phẩm hoặc số lượng trả không hợp lệ.';
    end if;

    select * into v_order_item
    from public.purchase_order_items
    where business_id = p_business_id
      and purchase_order_id = v_order_id
      and product_id = v_product_id
    order by id
    limit 1
    for update;

    if not found then
      raise exception 'Sản phẩm trả không thuộc phiếu nhập đã chọn.';
    end if;

    select coalesce(sum(pri.quantity), 0)
    into v_returned
    from public.purchase_return_items pri
    join public.purchase_returns pr on pr.id = pri.purchase_return_id
    where pri.business_id = p_business_id
      and pri.product_id = v_product_id
      and pr.purchase_order_id = v_order_id
      and lower(coalesce(pr.status, 'completed')) not in ('cancelled', 'canceled', 'draft');

    if v_quantity > greatest(0, v_order_item.quantity - v_returned) then
      raise exception 'Số lượng trả vượt quá số lượng còn có thể trả của sản phẩm.';
    end if;

    select * into v_product
    from public.products
    where id = v_product_id
      and business_id = p_business_id
    for update;

    if not found then
      raise exception 'Sản phẩm không còn tồn tại.';
    end if;

    if v_product.product_type <> 'service' and not v_allow_negative_stock and v_product.stock_on_hand < v_quantity then
      raise exception 'Tồn kho hiện tại không đủ để trả sản phẩm này cho nhà cung cấp.';
    end if;

    v_unit_cost := coalesce(v_order_item.unit_cost, 0);
    v_line_total := round(v_quantity * v_unit_cost, 2);
    v_total := v_total + v_line_total;
  end loop;

  v_refund := coalesce(nullif(p_return->>'refund_amount', '')::numeric, v_total);
  if v_refund < 0 or v_refund > v_total then
    raise exception 'Số tiền nhận lại không hợp lệ.';
  end if;
  v_refund := round(v_refund, 2);
  v_refund_now := coalesce((p_return->>'refund_now')::boolean, false);
  v_account_id := nullif(p_return->>'account_id', '')::uuid;

  if v_refund_now and v_refund > 0 and v_account_id is null then
    raise exception 'Cần chọn tài khoản nhận tiền từ nhà cung cấp.';
  end if;

  if v_refund_now and v_refund > 0 and not exists (
    select 1
    from public.finance_accounts
    where id = v_account_id
      and business_id = p_business_id
      and active = true
  ) then
    raise exception 'Tài khoản nhận tiền không hợp lệ.';
  end if;

  v_code := 'THN-' || to_char(current_date, 'YYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_header := jsonb_build_object(
    'id', gen_random_uuid(),
    'business_id', p_business_id,
    'code', v_code,
    'return_code', v_code,
    'return_number', v_code,
    'return_date', coalesce(nullif(p_return->>'return_date', ''), current_date::text),
    'returned_at', now(),
    'document_date', coalesce(nullif(p_return->>'return_date', ''), current_date::text),
    'purchase_order_id', v_order.id,
    'order_id', v_order.id,
    'supplier_id', v_order.supplier_id,
    'supplier_name', v_supplier_name,
    'supplier', v_supplier_name,
    'total', v_total,
    'total_amount', v_total,
    'amount', v_total,
    'return_amount', v_total,
    'refund_amount', v_refund,
    'refund_now', v_refund_now,
    'refund_status', case when v_refund_now and v_refund > 0 then 'refunded' else 'pending' end,
    'status', 'completed',
    'return_status', 'completed',
    'state', 'completed',
    'return_type', 'purchase',
    'reason', nullif(p_return->>'reason', ''),
    'note', nullif(p_return->>'note', ''),
    'account_id', v_account_id,
    'refund_account_id', v_account_id,
    'payment_method', nullif(p_return->>'payment_method', ''),
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
    and c.table_name = 'purchase_returns'
    and c.is_generated = 'NEVER'
    and v_header ? c.column_name;

  if v_columns is null then
    raise exception 'Bảng purchase_returns chưa có cột phù hợp để lưu phiếu trả hàng.';
  end if;

  execute format(
    'insert into public.purchase_returns (%s) select %s from jsonb_populate_record(null::public.purchase_returns, $1) r returning id',
    v_columns,
    v_values
  ) using v_header into v_return_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, nullif(v_item->>'return_quantity', '')::numeric, 0);

    select * into v_order_item
    from public.purchase_order_items
    where business_id = p_business_id
      and purchase_order_id = v_order_id
      and product_id = v_product_id
    order by id
    limit 1;

    select * into v_product
    from public.products
    where id = v_product_id
      and business_id = p_business_id;

    v_unit_cost := coalesce(v_order_item.unit_cost, 0);
    v_line_total := round(v_quantity * v_unit_cost, 2);
    v_item_payload := jsonb_build_object(
      'id', gen_random_uuid(),
      'business_id', p_business_id,
      'purchase_return_id', v_return_id,
      'return_id', v_return_id,
      'purchase_order_id', v_order_id,
      'purchase_order_item_id', v_order_item.id,
      'product_id', v_product_id,
      'product_code', v_product.code,
      'product_name', v_product.name,
      'unit', v_product.unit,
      'quantity', v_quantity,
      'return_quantity', v_quantity,
      'unit_cost', v_unit_cost,
      'unit_price', v_unit_cost,
      'line_total', v_line_total,
      'total', v_line_total,
      'note', nullif(v_item->>'note', ''),
      'created_at', now(),
      'updated_at', now()
    );

    select
      string_agg(format('%I', c.column_name), ', ' order by c.ordinal_position),
      string_agg(format('r.%I', c.column_name), ', ' order by c.ordinal_position)
    into v_columns, v_values
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'purchase_return_items'
      and c.is_generated = 'NEVER'
      and v_item_payload ? c.column_name;

    if v_columns is null then
      raise exception 'Bảng purchase_return_items chưa có cột phù hợp để lưu chi tiết.';
    end if;

    execute format(
      'insert into public.purchase_return_items (%s) select %s from jsonb_populate_record(null::public.purchase_return_items, $1)',
      v_columns,
      v_values
    ) using v_item_payload;

    if v_product.product_type <> 'service' then
      insert into public.stock_movements (
        business_id, product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, note, created_by
      ) values (
        p_business_id, v_product_id, 'return', -v_quantity, v_unit_cost,
        'purchase_return', v_return_id, 'Xuất trả nhà cung cấp theo phiếu ' || v_code, auth.uid()
      );
    end if;
  end loop;

  if v_refund_now and v_refund > 0 then
    insert into public.finance_transactions (
      business_id, transaction_date, direction, category, account_id, amount,
      payment_method, reference_type, reference_id, note, status, created_by
    ) values (
      p_business_id, current_date, 'in', 'Nhận tiền trả hàng', v_account_id, v_refund,
      coalesce(nullif(p_return->>'payment_method', ''), 'cash'), 'purchase_return', v_return_id,
      nullif(p_return->>'note', ''), 'posted', auth.uid()
    ) returning * into v_transaction;

    insert into public.payment_allocations (
      business_id, transaction_id, document_type, document_id, amount
    ) values (
      p_business_id, v_transaction.id, 'purchase_order', v_order_id, v_refund
    );
  end if;

  return jsonb_build_object('id', v_return_id, 'code', v_code, 'total', v_total, 'refund_amount', v_refund);
end;
$$;

grant execute on function public.create_purchase_return(uuid, jsonb, jsonb) to authenticated;

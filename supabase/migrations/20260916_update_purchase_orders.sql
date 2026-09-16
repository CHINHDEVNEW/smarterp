begin;

create or replace function public.app_update_purchase_order(
  p_business_id uuid,
  p_purchase_order_id uuid,
  p_order jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_product_id uuid;
  v_supplier_id uuid := nullif(p_order->>'supplier_id', '')::uuid;
  v_supplier_name text;
  v_quantity numeric;
  v_unit_cost numeric;
  v_old_quantity numeric;
  v_new_quantity numeric;
  v_new_unit_cost numeric;
  v_delta numeric;
  v_subtotal numeric := 0;
  v_discount numeric := greatest(0, coalesce(nullif(p_order->>'discount', '')::numeric, 0));
  v_shipping_fee numeric := greatest(0, coalesce(nullif(p_order->>'shipping_fee', '')::numeric, 0));
  v_vat_rate numeric := greatest(0, coalesce(nullif(p_order->>'vat_rate', '')::numeric, 0));
  v_vat_amount numeric;
  v_total numeric;
  v_paid numeric := 0;
  v_allow_negative boolean := false;
  v_order_date date := coalesce(nullif(p_order->>'order_date', '')::date, current_date);
  v_due_date date := nullif(p_order->>'due_date', '')::date;
begin
  perform public.assert_business_permission(p_business_id, 'purchases');

  select * into v_order
  from public.purchase_orders
  where id = p_purchase_order_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'Không tìm thấy phiếu nhập.';
  end if;
  if lower(coalesce(v_order.status, '')) in ('cancelled', 'canceled', 'draft') then
    raise exception 'Phiếu nhập đã hủy hoặc chưa xác nhận nên không thể sửa.';
  end if;
  if exists (
    select 1 from public.purchase_returns
    where business_id = p_business_id and purchase_order_id = p_purchase_order_id
  ) then
    raise exception 'Phiếu nhập đã có phiếu trả hàng. Hãy xóa phiếu trả trước khi sửa.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Phiếu nhập phải có ít nhất một sản phẩm.';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct nullif(value->>'product_id', '')) from jsonb_array_elements(p_items)) then
    raise exception 'Mỗi sản phẩm chỉ được xuất hiện một lần trong phiếu nhập.';
  end if;
  if v_due_date is not null and v_due_date < v_order_date then
    raise exception 'Hạn thanh toán không được trước ngày nhập hàng.';
  end if;

  if v_supplier_id is not null then
    select name into v_supplier_name
    from public.suppliers
    where id = v_supplier_id and business_id = p_business_id;
    if v_supplier_name is null then
      raise exception 'Nhà cung cấp không thuộc doanh nghiệp hiện tại.';
    end if;
  end if;

  -- Lock every affected product in a stable order before checking stock.
  perform 1
  from public.products p
  where p.business_id = p_business_id
    and p.id in (
      select poi.product_id
      from public.purchase_order_items poi
      where poi.business_id = p_business_id and poi.purchase_order_id = p_purchase_order_id
      union
      select nullif(value->>'product_id', '')::uuid
      from jsonb_array_elements(p_items)
    )
  order by p.id
  for update;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := nullif(v_item->>'product_id', '')::uuid;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
    v_unit_cost := coalesce(nullif(v_item->>'unit_cost', '')::numeric, 0);
    if v_product_id is null or v_quantity <= 0 or v_unit_cost < 0 then
      raise exception 'Sản phẩm, số lượng hoặc giá nhập không hợp lệ.';
    end if;
    select * into v_product
    from public.products
    where id = v_product_id and business_id = p_business_id;
    if not found then
      raise exception 'Có sản phẩm không thuộc doanh nghiệp hiện tại.';
    end if;
    v_subtotal := v_subtotal + v_quantity * v_unit_cost;
  end loop;

  if v_discount > v_subtotal then
    raise exception 'Tiền giảm giá không được lớn hơn tiền hàng.';
  end if;
  v_vat_amount := round((v_subtotal - v_discount) * v_vat_rate / 100, 2);
  v_total := v_subtotal - v_discount + v_shipping_fee + v_vat_amount;

  select coalesce(sum(pa.amount), 0) into v_paid
  from public.payment_allocations pa
  join public.finance_transactions ft
    on ft.id = pa.transaction_id and ft.business_id = pa.business_id
  where pa.business_id = p_business_id
    and pa.document_type = 'purchase_order'
    and pa.document_id = p_purchase_order_id
    and ft.reference_type = 'purchase_order'
    and ft.status = 'posted';

  if v_total < v_paid then
    raise exception 'Tổng phiếu sau khi sửa không được thấp hơn số tiền đã trả (%).', v_paid;
  end if;

  select coalesce((
    select allow_negative_stock
    from public.app_settings
    where business_id = p_business_id
  ), false) into v_allow_negative;

  for v_product_id in
    select poi.product_id
    from public.purchase_order_items poi
    where poi.business_id = p_business_id and poi.purchase_order_id = p_purchase_order_id
    union
    select nullif(value->>'product_id', '')::uuid
    from jsonb_array_elements(p_items)
  loop
    select * into v_product
    from public.products
    where id = v_product_id and business_id = p_business_id;

    select coalesce(sum(quantity), 0), max(unit_cost)
    into v_old_quantity, v_unit_cost
    from public.purchase_order_items
    where business_id = p_business_id
      and purchase_order_id = p_purchase_order_id
      and product_id = v_product_id;

    select coalesce(sum(nullif(value->>'quantity', '')::numeric), 0),
           max(nullif(value->>'unit_cost', '')::numeric)
    into v_new_quantity, v_new_unit_cost
    from jsonb_array_elements(p_items)
    where nullif(value->>'product_id', '')::uuid = v_product_id;

    v_delta := v_new_quantity - v_old_quantity;
    if v_product.product_type <> 'service'
       and not v_allow_negative
       and coalesce(v_product.stock_on_hand, 0) + v_delta < 0 then
      raise exception 'Không đủ tồn kho để giảm số lượng của sản phẩm %.', v_product.name;
    end if;

    if v_product.product_type <> 'service' and v_delta <> 0 then
      insert into public.stock_movements (
        business_id, product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, note, created_by
      ) values (
        p_business_id, v_product_id, 'adjustment', v_delta,
        coalesce(v_new_unit_cost, v_unit_cost, v_product.cost_price, 0),
        'purchase_order', p_purchase_order_id,
        'Điều chỉnh theo phiếu ' || v_order.code, auth.uid()
      );
    end if;

    if v_new_quantity > 0 and v_product.product_type <> 'service' then
      update public.stock_movements
      set unit_cost = v_new_unit_cost
      where business_id = p_business_id
        and product_id = v_product_id
        and reference_id = p_purchase_order_id
        and reference_type = 'purchase_order';
    end if;
  end loop;

  update public.purchase_orders
  set supplier_id = v_supplier_id,
      supplier_name = coalesce(v_supplier_name, 'Không chọn nhà cung cấp'),
      order_date = v_order_date,
      due_date = v_due_date,
      subtotal = round(v_subtotal, 2),
      discount = round(v_discount, 2),
      shipping_fee = round(v_shipping_fee, 2),
      vat_rate = v_vat_rate,
      vat_amount = v_vat_amount,
      total = round(v_total, 2),
      note = nullif(btrim(p_order->>'note'), '')
  where id = p_purchase_order_id and business_id = p_business_id
  returning * into v_order;

  delete from public.purchase_order_items
  where business_id = p_business_id and purchase_order_id = p_purchase_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item->>'product_id')::uuid;
    select * into v_product
    from public.products
    where id = v_product_id and business_id = p_business_id;

    insert into public.purchase_order_items (
      business_id, purchase_order_id, product_id, product_code, product_name,
      unit, quantity, unit_cost, note
    ) values (
      p_business_id, p_purchase_order_id, v_product.id, v_product.code, v_product.name,
      v_product.unit, (v_item->>'quantity')::numeric, (v_item->>'unit_cost')::numeric,
      nullif(v_item->>'note', '')
    );
  end loop;

  return to_jsonb(v_order);
end;
$$;

revoke execute on function public.app_update_purchase_order(uuid, uuid, jsonb, jsonb) from public, anon;
grant execute on function public.app_update_purchase_order(uuid, uuid, jsonb, jsonb) to authenticated;

commit;

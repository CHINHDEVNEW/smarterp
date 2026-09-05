-- Tạo đơn bán và các biến động kho trong cùng một transaction.
-- Chạy file này một lần trong Supabase SQL Editor trước khi tạo đơn từ ứng dụng.

create or replace function public.create_sales_order(
  p_business_id uuid,
  p_order jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order public.sales_orders%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_quantity numeric;
  v_unit_price numeric;
  v_subtotal numeric := 0;
  v_discount numeric := greatest(0, coalesce((p_order->>'discount')::numeric, 0));
  v_shipping_fee numeric := greatest(0, coalesce((p_order->>'shipping_fee')::numeric, 0));
  v_vat_rate numeric := greatest(0, coalesce((p_order->>'vat_rate')::numeric, 0));
  v_vat_amount numeric;
  v_total numeric;
  v_allow_negative_stock boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập để tạo đơn bán.';
  end if;

  if not exists (
    select 1
    from public.business_members
    where business_id = p_business_id
      and user_id = auth.uid()
      and active = true
  ) then
    raise exception 'Bạn không có quyền tạo đơn cho doanh nghiệp này.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Đơn bán phải có ít nhất một sản phẩm.';
  end if;

  if nullif(p_order->>'customer_id', '') is not null and not exists (
    select 1 from public.customers
    where id = (p_order->>'customer_id')::uuid
      and business_id = p_business_id
      and active = true
  ) then
    raise exception 'Khách hàng không hợp lệ hoặc đã ngừng giao dịch.';
  end if;

  select coalesce(allow_negative_stock, false)
  into v_allow_negative_stock
  from public.app_settings
  where business_id = p_business_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::numeric, 0);
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);

    if v_quantity <= 0 or v_unit_price < 0 then
      raise exception 'Số lượng và đơn giá sản phẩm không hợp lệ.';
    end if;

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and business_id = p_business_id
      and active = true
    for update;

    if not found then
      raise exception 'Có sản phẩm không tồn tại hoặc đã ngừng kinh doanh.';
    end if;

    if v_product.product_type <> 'service'
       and not v_allow_negative_stock
       and v_product.stock_on_hand < v_quantity then
      raise exception 'Sản phẩm "%" không đủ tồn kho.', v_product.name;
    end if;

    v_subtotal := v_subtotal + (v_quantity * v_unit_price);
  end loop;

  if v_discount > v_subtotal then
    raise exception 'Tiền giảm giá không được lớn hơn tiền hàng.';
  end if;

  v_vat_amount := round((v_subtotal - v_discount) * v_vat_rate / 100, 2);
  v_total := v_subtotal - v_discount + v_shipping_fee + v_vat_amount;

  insert into public.sales_orders (
    business_id, customer_id, order_date, due_date, status, channel,
    subtotal, discount, shipping_fee, vat_rate, vat_amount, total, note, created_by
  ) values (
    p_business_id,
    nullif(p_order->>'customer_id', '')::uuid,
    coalesce(nullif(p_order->>'order_date', '')::date, current_date),
    nullif(p_order->>'due_date', '')::date,
    'confirmed',
    coalesce(nullif(p_order->>'channel', ''), 'sales'),
    v_subtotal,
    v_discount,
    v_shipping_fee,
    v_vat_rate,
    v_vat_amount,
    v_total,
    nullif(p_order->>'note', ''),
    auth.uid()
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;

    select * into v_product
    from public.products
    where id = (v_item->>'product_id')::uuid
      and business_id = p_business_id;

    insert into public.sales_order_items (
      business_id, sales_order_id, product_id, product_code, product_name,
      unit, quantity, unit_price, unit_cost, note
    ) values (
      p_business_id, v_order.id, v_product.id, v_product.code, v_product.name,
      v_product.unit, v_quantity, v_unit_price, v_product.cost_price,
      nullif(v_item->>'note', '')
    );

    if v_product.product_type <> 'service' then
      insert into public.stock_movements (
        business_id, product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, note, created_by
      ) values (
        p_business_id, v_product.id, 'sale', -v_quantity, v_product.cost_price,
        'sales_order', v_order.id, 'Xuất kho theo đơn bán ' || v_order.code, auth.uid()
      );
    end if;
  end loop;

  return to_jsonb(v_order);
end;
$$;

grant execute on function public.create_sales_order(uuid, jsonb, jsonb) to authenticated;

create or replace function public.record_sales_payment(
  p_business_id uuid,
  p_sales_order_id uuid,
  p_amount numeric,
  p_account_id uuid,
  p_payment_method text default 'cash',
  p_note text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order public.sales_orders%rowtype;
  v_paid numeric := 0;
  v_due numeric;
  v_transaction public.finance_transactions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập để ghi nhận thanh toán.';
  end if;

  if not exists (
    select 1 from public.business_members
    where business_id = p_business_id and user_id = auth.uid() and active = true
  ) then
    raise exception 'Bạn không có quyền ghi nhận thanh toán cho doanh nghiệp này.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Số tiền thanh toán phải lớn hơn 0.';
  end if;

  select * into v_order
  from public.sales_orders
  where id = p_sales_order_id and business_id = p_business_id
  for update;

  if not found or v_order.status in ('cancelled', 'draft') then
    raise exception 'Đơn bán không hợp lệ để ghi nhận thanh toán.';
  end if;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.payment_allocations
  where business_id = p_business_id
    and document_type = 'sales_order'
    and document_id = p_sales_order_id;

  v_due := greatest(0, v_order.total - v_paid);
  if p_amount > v_due then
    raise exception 'Số tiền thu vượt quá số còn nợ của đơn.';
  end if;

  if not exists (
    select 1 from public.finance_accounts
    where id = p_account_id and business_id = p_business_id and active = true
  ) then
    raise exception 'Tài khoản tiền không hợp lệ.';
  end if;

  insert into public.finance_transactions (
    business_id, transaction_date, direction, category, account_id, amount,
    payment_method, reference_type, reference_id, note, status, created_by
  ) values (
    p_business_id, current_date, 'in', 'Thu tiền bán hàng', p_account_id, p_amount,
    coalesce(nullif(p_payment_method, ''), 'cash'), 'sales_order', p_sales_order_id,
    nullif(p_note, ''), 'posted', auth.uid()
  ) returning * into v_transaction;

  insert into public.payment_allocations (
    business_id, transaction_id, document_type, document_id, amount
  ) values (
    p_business_id, v_transaction.id, 'sales_order', p_sales_order_id, p_amount
  );

  return to_jsonb(v_transaction);
end;
$$;

grant execute on function public.record_sales_payment(uuid, uuid, numeric, uuid, text, text) to authenticated;

create or replace function public.create_purchase_order(
  p_business_id uuid,
  p_order jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_quantity numeric;
  v_unit_cost numeric;
  v_subtotal numeric := 0;
  v_discount numeric := greatest(0, coalesce((p_order->>'discount')::numeric, 0));
  v_shipping_fee numeric := greatest(0, coalesce((p_order->>'shipping_fee')::numeric, 0));
  v_vat_rate numeric := greatest(0, coalesce((p_order->>'vat_rate')::numeric, 0));
  v_vat_amount numeric;
  v_total numeric;
begin
  if auth.uid() is null then raise exception 'Bạn cần đăng nhập để tạo phiếu nhập.'; end if;
  if not exists (select 1 from public.business_members where business_id = p_business_id and user_id = auth.uid() and active = true) then
    raise exception 'Bạn không có quyền tạo phiếu nhập cho doanh nghiệp này.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Phiếu nhập phải có ít nhất một sản phẩm.'; end if;
  if nullif(p_order->>'supplier_id', '') is not null and not exists (
    select 1 from public.suppliers where id = (p_order->>'supplier_id')::uuid and business_id = p_business_id and active = true
  ) then raise exception 'Nhà cung cấp không hợp lệ hoặc đã ngừng giao dịch.'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::numeric, 0);
    v_unit_cost := coalesce((v_item->>'unit_cost')::numeric, 0);
    if v_quantity <= 0 or v_unit_cost < 0 then raise exception 'Số lượng và giá nhập không hợp lệ.'; end if;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and business_id = p_business_id and active = true for update;
    if not found then raise exception 'Có sản phẩm không tồn tại hoặc đã ngừng kinh doanh.'; end if;
    v_subtotal := v_subtotal + (v_quantity * v_unit_cost);
  end loop;
  if v_discount > v_subtotal then raise exception 'Tiền giảm giá không được lớn hơn tiền hàng.'; end if;
  v_vat_amount := round((v_subtotal - v_discount) * v_vat_rate / 100, 2);
  v_total := v_subtotal - v_discount + v_shipping_fee + v_vat_amount;

  insert into public.purchase_orders (
    business_id, supplier_id, order_date, due_date, status, subtotal, discount,
    shipping_fee, vat_rate, vat_amount, total, note, created_by
  ) values (
    p_business_id, nullif(p_order->>'supplier_id', '')::uuid,
    coalesce(nullif(p_order->>'order_date', '')::date, current_date),
    nullif(p_order->>'due_date', '')::date, 'confirmed', v_subtotal, v_discount,
    v_shipping_fee, v_vat_rate, v_vat_amount, v_total, nullif(p_order->>'note', ''), auth.uid()
  ) returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_cost := (v_item->>'unit_cost')::numeric;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and business_id = p_business_id;
    insert into public.purchase_order_items (
      business_id, purchase_order_id, product_id, product_code, product_name,
      unit, quantity, unit_cost, note
    ) values (
      p_business_id, v_order.id, v_product.id, v_product.code, v_product.name,
      v_product.unit, v_quantity, v_unit_cost, nullif(v_item->>'note', '')
    );
    if v_product.product_type <> 'service' then
      insert into public.stock_movements (
        business_id, product_id, movement_type, quantity, unit_cost,
        reference_type, reference_id, note, created_by
      ) values (
        p_business_id, v_product.id, 'purchase', v_quantity, v_unit_cost,
        'purchase_order', v_order.id, 'Nhập kho theo phiếu ' || v_order.code, auth.uid()
      );
    end if;
  end loop;
  return to_jsonb(v_order);
end;
$$;

grant execute on function public.create_purchase_order(uuid, jsonb, jsonb) to authenticated;

create or replace function public.create_quote(
  p_business_id uuid,
  p_quote jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_quote public.quotes%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_quantity numeric;
  v_unit_price numeric;
  v_subtotal numeric := 0;
  v_discount numeric := greatest(0, coalesce((p_quote->>'discount')::numeric, 0));
  v_shipping_fee numeric := greatest(0, coalesce((p_quote->>'shipping_fee')::numeric, 0));
  v_vat_rate numeric := greatest(0, coalesce((p_quote->>'vat_rate')::numeric, 0));
  v_vat_amount numeric;
  v_total numeric;
begin
  if auth.uid() is null then raise exception 'Bạn cần đăng nhập để tạo báo giá.'; end if;
  if not exists (select 1 from public.business_members where business_id = p_business_id and user_id = auth.uid() and active = true) then
    raise exception 'Bạn không có quyền tạo báo giá cho doanh nghiệp này.';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Báo giá phải có ít nhất một sản phẩm.'; end if;
  if nullif(p_quote->>'customer_id', '') is not null and not exists (
    select 1 from public.customers where id = (p_quote->>'customer_id')::uuid and business_id = p_business_id and active = true
  ) then raise exception 'Khách hàng không hợp lệ hoặc đã ngừng giao dịch.'; end if;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item->>'quantity')::numeric, 0);
    v_unit_price := coalesce((v_item->>'unit_price')::numeric, 0);
    if v_quantity <= 0 or v_unit_price < 0 then raise exception 'Số lượng và đơn giá không hợp lệ.'; end if;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and business_id = p_business_id and active = true;
    if not found then raise exception 'Có sản phẩm không tồn tại hoặc đã ngừng kinh doanh.'; end if;
    v_subtotal := v_subtotal + (v_quantity * v_unit_price);
  end loop;
  if v_discount > v_subtotal then raise exception 'Tiền giảm giá không được lớn hơn tiền hàng.'; end if;
  v_vat_amount := round((v_subtotal - v_discount) * v_vat_rate / 100, 2);
  v_total := v_subtotal - v_discount + v_shipping_fee + v_vat_amount;
  insert into public.quotes (
    business_id, customer_id, quote_date, valid_until, status, subtotal, discount,
    shipping_fee, vat_rate, vat_amount, total, note, created_by
  ) values (
    p_business_id, nullif(p_quote->>'customer_id', '')::uuid,
    coalesce(nullif(p_quote->>'quote_date', '')::date, current_date),
    nullif(p_quote->>'valid_until', '')::date, 'draft', v_subtotal, v_discount,
    v_shipping_fee, v_vat_rate, v_vat_amount, v_total, nullif(p_quote->>'note', ''), auth.uid()
  ) returning * into v_quote;
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_price := (v_item->>'unit_price')::numeric;
    select * into v_product from public.products where id = (v_item->>'product_id')::uuid and business_id = p_business_id;
    insert into public.quote_items (
      business_id, quote_id, product_id, product_code, product_name, unit,
      quantity, unit_price, note
    ) values (
      p_business_id, v_quote.id, v_product.id, v_product.code, v_product.name,
      v_product.unit, v_quantity, v_unit_price, nullif(v_item->>'note', '')
    );
  end loop;
  return to_jsonb(v_quote);
end;
$$;

grant execute on function public.create_quote(uuid, jsonb, jsonb) to authenticated;

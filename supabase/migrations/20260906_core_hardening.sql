-- SmartERP core hardening
-- Run once in Supabase SQL Editor after the 20260905 migrations.
-- This migration is additive and does not delete business data.

create extension if not exists pgcrypto;

-- Standard columns used by the hardened workflows. Existing columns are preserved.
alter table public.quotes
  add column if not exists converted_sales_order_id uuid references public.sales_orders(id) on delete set null;

alter table public.sales_returns
  add column if not exists code text,
  add column if not exists return_date date,
  add column if not exists sales_order_id uuid,
  add column if not exists customer_id uuid,
  add column if not exists customer_name text,
  add column if not exists status text,
  add column if not exists reason text,
  add column if not exists note text,
  add column if not exists total numeric(15,2),
  add column if not exists subtotal numeric(15,2) not null default 0,
  add column if not exists discount numeric(15,2) not null default 0,
  add column if not exists vat_amount numeric(15,2) not null default 0,
  add column if not exists net_total numeric(15,2),
  add column if not exists refund_amount numeric(15,2) not null default 0,
  add column if not exists refund_status text not null default 'pending',
  add column if not exists refunded_amount numeric(15,2) not null default 0;

alter table public.purchase_returns
  add column if not exists code text,
  add column if not exists return_date date,
  add column if not exists purchase_order_id uuid,
  add column if not exists supplier_id uuid,
  add column if not exists supplier_name text,
  add column if not exists status text,
  add column if not exists reason text,
  add column if not exists note text,
  add column if not exists total numeric(15,2),
  add column if not exists subtotal numeric(15,2) not null default 0,
  add column if not exists discount numeric(15,2) not null default 0,
  add column if not exists vat_amount numeric(15,2) not null default 0,
  add column if not exists net_total numeric(15,2),
  add column if not exists refund_amount numeric(15,2) not null default 0,
  add column if not exists refund_status text not null default 'pending',
  add column if not exists refunded_amount numeric(15,2) not null default 0;

alter table public.sales_return_items
  add column if not exists sales_return_id uuid,
  add column if not exists sales_order_item_id uuid references public.sales_order_items(id) on delete restrict,
  add column if not exists product_code text,
  add column if not exists product_name text,
  add column if not exists unit text,
  add column if not exists quantity numeric(15,3),
  add column if not exists unit_price numeric(15,2),
  add column if not exists unit_cost numeric(15,2),
  add column if not exists line_total numeric(15,2),
  add column if not exists discount_amount numeric(15,2) not null default 0,
  add column if not exists vat_amount numeric(15,2) not null default 0,
  add column if not exists net_line_total numeric(15,2);

alter table public.purchase_return_items
  add column if not exists purchase_return_id uuid,
  add column if not exists purchase_order_item_id uuid references public.purchase_order_items(id) on delete restrict,
  add column if not exists product_code text,
  add column if not exists product_name text,
  add column if not exists unit text,
  add column if not exists quantity numeric(15,3),
  add column if not exists unit_cost numeric(15,2),
  add column if not exists unit_price numeric(15,2),
  add column if not exists line_total numeric(15,2),
  add column if not exists discount_amount numeric(15,2) not null default 0,
  add column if not exists vat_amount numeric(15,2) not null default 0,
  add column if not exists net_line_total numeric(15,2);

-- Older installations may store the return value as total_amount, amount or
-- return_amount. Copy it into the standard total column without discarding data.
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_returns' and column_name = 'return_code') then
    execute 'update public.sales_returns set code = coalesce(code, return_code)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_returns' and column_name = 'return_number') then
    execute 'update public.sales_returns set code = coalesce(code, return_number)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_returns' and column_name = 'document_date') then
    execute 'update public.sales_returns set return_date = coalesce(return_date, document_date::date)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_returns' and column_name = 'returned_at') then
    execute 'update public.sales_returns set return_date = coalesce(return_date, returned_at::date)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_returns' and column_name = 'order_id') then
    execute 'update public.sales_returns set sales_order_id = coalesce(sales_order_id, order_id)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_returns' and column_name = 'customer') then
    execute 'update public.sales_returns set customer_name = coalesce(customer_name, customer::text)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_returns' and column_name = 'return_status') then
    execute 'update public.sales_returns set status = coalesce(status, return_status::text)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_returns' and column_name = 'state') then
    execute 'update public.sales_returns set status = coalesce(status, state::text)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_returns' and column_name = 'total_amount') then
    execute 'update public.sales_returns set total = coalesce(total, total_amount)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_returns' and column_name = 'amount') then
    execute 'update public.sales_returns set total = coalesce(total, amount)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_returns' and column_name = 'return_amount') then
    execute 'update public.sales_returns set total = coalesce(total, return_amount)';
  end if;
  update public.sales_returns set total = coalesce(total, refund_amount, 0);

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_returns' and column_name = 'return_code') then
    execute 'update public.purchase_returns set code = coalesce(code, return_code)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_returns' and column_name = 'return_number') then
    execute 'update public.purchase_returns set code = coalesce(code, return_number)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_returns' and column_name = 'document_date') then
    execute 'update public.purchase_returns set return_date = coalesce(return_date, document_date::date)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_returns' and column_name = 'returned_at') then
    execute 'update public.purchase_returns set return_date = coalesce(return_date, returned_at::date)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_returns' and column_name = 'order_id') then
    execute 'update public.purchase_returns set purchase_order_id = coalesce(purchase_order_id, order_id)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_returns' and column_name = 'supplier') then
    execute 'update public.purchase_returns set supplier_name = coalesce(supplier_name, supplier::text)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_returns' and column_name = 'return_status') then
    execute 'update public.purchase_returns set status = coalesce(status, return_status::text)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_returns' and column_name = 'state') then
    execute 'update public.purchase_returns set status = coalesce(status, state::text)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_returns' and column_name = 'total_amount') then
    execute 'update public.purchase_returns set total = coalesce(total, total_amount)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_returns' and column_name = 'amount') then
    execute 'update public.purchase_returns set total = coalesce(total, amount)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_returns' and column_name = 'return_amount') then
    execute 'update public.purchase_returns set total = coalesce(total, return_amount)';
  end if;
  update public.purchase_returns set total = coalesce(total, refund_amount, 0);

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_return_items' and column_name = 'return_id') then
    execute 'update public.sales_return_items set sales_return_id = coalesce(sales_return_id, return_id)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'sales_return_items' and column_name = 'return_quantity') then
    execute 'update public.sales_return_items set quantity = coalesce(quantity, return_quantity)';
  end if;
  update public.sales_return_items
  set unit_price = coalesce(unit_price, 0),
      unit_cost = coalesce(unit_cost, unit_price, 0),
      quantity = coalesce(quantity, 0);

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_return_items' and column_name = 'return_id') then
    execute 'update public.purchase_return_items set purchase_return_id = coalesce(purchase_return_id, return_id)';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'purchase_return_items' and column_name = 'return_quantity') then
    execute 'update public.purchase_return_items set quantity = coalesce(quantity, return_quantity)';
  end if;
  update public.purchase_return_items
  set unit_cost = coalesce(unit_cost, unit_price, 0),
      unit_price = coalesce(unit_price, unit_cost, 0),
      quantity = coalesce(quantity, 0);
end;
$$;

-- Preserve settlements made by the older return functions before this migration.
update public.sales_returns
set refunded_amount = least(coalesce(net_total, total, 0), greatest(refunded_amount, coalesce(refund_amount, 0)))
where coalesce(refund_amount, 0) > refunded_amount;

update public.purchase_returns
set refunded_amount = least(coalesce(net_total, total, 0), greatest(refunded_amount, coalesce(refund_amount, 0)))
where coalesce(refund_amount, 0) > refunded_amount;

-- Resolve the current member role without exposing unrestricted table access.
create or replace function public.business_role(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select lower(bm.role::text)
  from public.business_members bm
  where bm.business_id = p_business_id
    and bm.user_id = auth.uid()
    and bm.active = true
  limit 1
$$;

create or replace function public.has_business_permission(
  p_business_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.business_role(p_business_id);
begin
  if v_role is null then return false; end if;
  if v_role in ('owner', 'admin') then return true; end if;

  return case lower(coalesce(p_permission, ''))
    when 'read' then true
    when 'reports' then true
    when 'sales' then v_role in ('manager', 'sales', 'staff', 'member')
    when 'sales_payment' then v_role in ('manager', 'sales', 'accountant', 'staff', 'member')
    when 'quotes' then v_role in ('manager', 'sales', 'staff', 'member')
    when 'customers' then v_role in ('manager', 'sales', 'staff', 'member')
    when 'purchases' then v_role in ('manager', 'purchasing', 'warehouse')
    when 'purchase_payment' then v_role in ('manager', 'purchasing', 'accountant')
    when 'inventory' then v_role in ('manager', 'warehouse')
    when 'sales_return' then v_role in ('manager', 'sales', 'warehouse')
    when 'purchase_return' then v_role in ('manager', 'purchasing', 'warehouse')
    when 'finance' then v_role in ('manager', 'accountant')
    else false
  end;
end;
$$;

create or replace function public.assert_business_permission(
  p_business_id uuid,
  p_permission text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Bạn cần đăng nhập để thực hiện thao tác này.';
  end if;
  if not public.has_business_permission(p_business_id, p_permission) then
    raise exception 'Bạn không có quyền thực hiện thao tác này.';
  end if;
end;
$$;

-- Use document_sequences consistently for new hardened documents.
create or replace function public.take_document_code(
  p_business_id uuid,
  p_entity text,
  p_fallback_prefix text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_prefix text;
  v_number bigint;
  v_padding integer;
begin
  select ds.prefix, ds.next_number, ds.padding
  into v_prefix, v_number, v_padding
  from public.document_sequences ds
  where ds.business_id = p_business_id
    and ds.entity = p_entity
  for update;

  if found then
    update public.document_sequences
    set next_number = v_number + 1
    where business_id = p_business_id and entity = p_entity;
    return coalesce(v_prefix, p_fallback_prefix) || lpad(v_number::text, greatest(1, coalesce(v_padding, 4)), '0');
  end if;

  return p_fallback_prefix || to_char(clock_timestamp(), 'YYMMDDHH24MISS') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
end;
$$;

-- Net order views: returns reduce document value; only posted document payments count.
create or replace view public.v_app_sales_orders
with (security_invoker = true)
as
with paid as (
  select pa.business_id, pa.document_id,
    sum(pa.amount) filter (
      where ft.status = 'posted' and ft.reference_type = 'sales_order'
    ) as amount
  from public.payment_allocations pa
  join public.finance_transactions ft on ft.id = pa.transaction_id
  where pa.document_type = 'sales_order'
  group by pa.business_id, pa.document_id
), returned as (
  select sr.business_id, sr.sales_order_id,
    sum(coalesce(sr.net_total, sr.total, 0)) as amount
  from public.sales_returns sr
  where lower(coalesce(sr.status, 'completed')) not in ('cancelled', 'canceled', 'draft')
  group by sr.business_id, sr.sales_order_id
)
select
  so.id, so.business_id, so.code, so.order_date, so.due_date, so.customer_id,
  coalesce(c.name, 'Khách lẻ') as customer_name,
  so.status, so.channel, so.subtotal, so.discount, so.shipping_fee,
  so.vat_rate, so.vat_amount, so.total,
  coalesce(r.amount, 0)::numeric(15,2) as return_total,
  greatest(0, so.total - coalesce(r.amount, 0))::numeric(15,2) as net_total,
  least(
    greatest(0, so.total - coalesce(r.amount, 0)),
    coalesce(p.amount, 0)
  )::numeric(15,2) as paid_amount,
  greatest(0, so.total - coalesce(r.amount, 0) - coalesce(p.amount, 0))::numeric(15,2) as balance_due,
  case
    when greatest(0, so.total - coalesce(r.amount, 0)) = 0 then 'paid'
    when coalesce(p.amount, 0) <= 0 then 'unpaid'
    when coalesce(p.amount, 0) >= greatest(0, so.total - coalesce(r.amount, 0)) then 'paid'
    else 'partial'
  end as payment_status,
  so.note, so.created_by, so.created_at
from public.sales_orders so
left join public.customers c on c.id = so.customer_id and c.business_id = so.business_id
left join paid p on p.business_id = so.business_id and p.document_id = so.id
left join returned r on r.business_id = so.business_id and r.sales_order_id = so.id;

create or replace view public.v_app_purchase_orders
with (security_invoker = true)
as
with paid as (
  select pa.business_id, pa.document_id,
    sum(pa.amount) filter (
      where ft.status = 'posted' and ft.reference_type = 'purchase_order'
    ) as amount
  from public.payment_allocations pa
  join public.finance_transactions ft on ft.id = pa.transaction_id
  where pa.document_type = 'purchase_order'
  group by pa.business_id, pa.document_id
), returned as (
  select pr.business_id, pr.purchase_order_id,
    sum(coalesce(pr.net_total, pr.total, 0)) as amount
  from public.purchase_returns pr
  where lower(coalesce(pr.status, 'completed')) not in ('cancelled', 'canceled', 'draft')
  group by pr.business_id, pr.purchase_order_id
)
select
  po.id, po.business_id, po.code, po.order_date, po.due_date, po.supplier_id,
  coalesce(s.name, 'Không chọn nhà cung cấp') as supplier_name,
  po.status, po.subtotal, po.discount, po.shipping_fee,
  po.vat_rate, po.vat_amount, po.total,
  coalesce(r.amount, 0)::numeric(15,2) as return_total,
  greatest(0, po.total - coalesce(r.amount, 0))::numeric(15,2) as net_total,
  least(
    greatest(0, po.total - coalesce(r.amount, 0)),
    coalesce(p.amount, 0)
  )::numeric(15,2) as paid_amount,
  greatest(0, po.total - coalesce(r.amount, 0) - coalesce(p.amount, 0))::numeric(15,2) as balance_due,
  case
    when greatest(0, po.total - coalesce(r.amount, 0)) = 0 then 'paid'
    when coalesce(p.amount, 0) <= 0 then 'unpaid'
    when coalesce(p.amount, 0) >= greatest(0, po.total - coalesce(r.amount, 0)) then 'paid'
    else 'partial'
  end as payment_status,
  po.note, po.created_by, po.created_at
from public.purchase_orders po
left join public.suppliers s on s.id = po.supplier_id and s.business_id = po.business_id
left join paid p on p.business_id = po.business_id and p.document_id = po.id
left join returned r on r.business_id = po.business_id and r.purchase_order_id = po.id;

create or replace view public.v_finance_account_balances
with (security_invoker = true)
as
select
  fa.id, fa.business_id, fa.code, fa.name, fa.account_type,
  fa.opening_balance, fa.active,
  (coalesce(fa.opening_balance, 0) + coalesce(sum(
    case
      when ft.status = 'posted' and ft.direction = 'in' then ft.amount
      when ft.status = 'posted' and ft.direction = 'out' then -ft.amount
      else 0
    end
  ), 0))::numeric(15,2) as balance
from public.finance_accounts fa
left join public.finance_transactions ft
  on ft.account_id = fa.id and ft.business_id = fa.business_id
group by fa.id, fa.business_id, fa.code, fa.name, fa.account_type, fa.opening_balance, fa.active;

grant select on public.v_app_sales_orders, public.v_app_purchase_orders, public.v_finance_account_balances to authenticated;

-- Role-checked wrappers around the existing transactional functions.
create or replace function public.app_create_sales_order(
  p_business_id uuid,
  p_order jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_business_permission(p_business_id, 'sales');
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Đơn bán phải có ít nhất một sản phẩm.';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct nullif(value->>'product_id', '')) from jsonb_array_elements(p_items)) then
    raise exception 'Mỗi sản phẩm chỉ được xuất hiện một lần trong đơn.';
  end if;
  return public.create_sales_order(p_business_id, p_order, p_items);
end;
$$;

create or replace function public.app_record_sales_payment(
  p_business_id uuid,
  p_sales_order_id uuid,
  p_amount numeric,
  p_account_id uuid,
  p_payment_method text default 'cash',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.sales_orders%rowtype;
  v_due numeric;
  v_transaction public.finance_transactions%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'sales_payment');

  select * into v_order
  from public.sales_orders
  where id = p_sales_order_id and business_id = p_business_id
  for update;
  if not found or lower(coalesce(v_order.status, '')) in ('cancelled', 'canceled', 'draft') then
    raise exception 'Đơn bán không hợp lệ để ghi nhận thanh toán.';
  end if;

  select balance_due into v_due
  from public.v_app_sales_orders
  where id = p_sales_order_id and business_id = p_business_id;
  if v_due is null then raise exception 'Không tìm thấy đơn bán.'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > v_due then
    raise exception 'Số tiền thu không hợp lệ hoặc vượt quá số còn phải thu.';
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

create or replace function public.app_create_pos_sale(
  p_business_id uuid,
  p_order jsonb,
  p_items jsonb,
  p_account_id uuid,
  p_payment_method text default 'cash'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order jsonb;
  v_payment jsonb;
  v_total numeric;
begin
  perform public.assert_business_permission(p_business_id, 'sales_payment');
  v_order := public.app_create_sales_order(
    p_business_id,
    coalesce(p_order, '{}'::jsonb) || jsonb_build_object('channel', 'pos'),
    p_items
  );
  v_total := coalesce((v_order->>'total')::numeric, 0);
  if v_total <= 0 then raise exception 'Tổng thanh toán của đơn POS không hợp lệ.'; end if;
  v_payment := public.app_record_sales_payment(
    p_business_id,
    (v_order->>'id')::uuid,
    v_total,
    p_account_id,
    p_payment_method,
    'Thanh toán ngay tại POS'
  );
  return v_order || jsonb_build_object('payment', v_payment, 'paid_amount', v_total, 'balance_due', 0);
end;
$$;

create or replace function public.app_create_purchase_order(
  p_business_id uuid,
  p_order jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_business_permission(p_business_id, 'purchases');
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Phiếu nhập phải có ít nhất một sản phẩm.';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct nullif(value->>'product_id', '')) from jsonb_array_elements(p_items)) then
    raise exception 'Mỗi sản phẩm chỉ được xuất hiện một lần trong phiếu nhập.';
  end if;
  return public.create_purchase_order(p_business_id, p_order, p_items);
end;
$$;

create or replace function public.app_record_purchase_payment(
  p_business_id uuid,
  p_purchase_order_id uuid,
  p_amount numeric,
  p_account_id uuid,
  p_payment_method text default 'cash',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_due numeric;
  v_transaction public.finance_transactions%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'purchase_payment');

  select * into v_order
  from public.purchase_orders
  where id = p_purchase_order_id and business_id = p_business_id
  for update;
  if not found or lower(coalesce(v_order.status, '')) in ('cancelled', 'canceled', 'draft') then
    raise exception 'Phiếu nhập không hợp lệ để ghi nhận thanh toán.';
  end if;

  select balance_due into v_due
  from public.v_app_purchase_orders
  where id = p_purchase_order_id and business_id = p_business_id;
  if v_due is null then raise exception 'Không tìm thấy phiếu nhập.'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > v_due then
    raise exception 'Số tiền trả không hợp lệ hoặc vượt quá số còn phải trả.';
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
    p_business_id, current_date, 'out', 'Thanh toán nhập hàng', p_account_id, p_amount,
    coalesce(nullif(p_payment_method, ''), 'cash'), 'purchase_order', p_purchase_order_id,
    nullif(p_note, ''), 'posted', auth.uid()
  ) returning * into v_transaction;

  insert into public.payment_allocations (
    business_id, transaction_id, document_type, document_id, amount
  ) values (
    p_business_id, v_transaction.id, 'purchase_order', p_purchase_order_id, p_amount
  );

  return to_jsonb(v_transaction);
end;
$$;

create or replace function public.app_create_quote(
  p_business_id uuid,
  p_quote jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.assert_business_permission(p_business_id, 'quotes');
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Báo giá phải có ít nhất một sản phẩm.';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct nullif(value->>'product_id', '')) from jsonb_array_elements(p_items)) then
    raise exception 'Mỗi sản phẩm chỉ được xuất hiện một lần trong báo giá.';
  end if;
  return public.create_quote(p_business_id, p_quote, p_items);
end;
$$;

-- Correct return accounting: create stock return first, then calculate proportional
-- discount/VAT and record refund separately from order payment allocations.
create or replace function public.app_create_sales_return(
  p_business_id uuid,
  p_return jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_return_id uuid;
  v_code text;
  v_subtotal numeric;
  v_discount numeric;
  v_vat numeric;
  v_total numeric;
  v_requested numeric;
  v_order_id uuid;
  v_order_total numeric;
  v_paid numeric;
  v_returned numeric;
  v_prior_settled numeric;
  v_cash_available numeric;
  v_refund_now boolean := coalesce((p_return->>'refund_now')::boolean, false);
  v_account_id uuid := nullif(p_return->>'account_id', '')::uuid;
  v_transaction public.finance_transactions%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'sales_return');
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Phiếu trả phải có ít nhất một sản phẩm.';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct nullif(value->>'product_id', '')) from jsonb_array_elements(p_items)) then
    raise exception 'Mỗi sản phẩm chỉ được xuất hiện một lần trong phiếu trả.';
  end if;

  v_result := public.create_sales_return(
    p_business_id,
    (p_return - 'refund_now' - 'refund_amount' - 'account_id' - 'payment_method') || jsonb_build_object('refund_now', false),
    p_items
  );
  v_return_id := (v_result->>'id')::uuid;

  update public.sales_return_items sri
  set
    discount_amount = round(
      case when so.subtotal > 0 then so.discount * (sri.quantity * sri.unit_price) / so.subtotal else 0 end,
      2
    ),
    vat_amount = round(
      ((sri.quantity * sri.unit_price) -
        case when so.subtotal > 0 then so.discount * (sri.quantity * sri.unit_price) / so.subtotal else 0 end
      ) * so.vat_rate / 100,
      2
    ),
    net_line_total = round(
      (sri.quantity * sri.unit_price) -
      case when so.subtotal > 0 then so.discount * (sri.quantity * sri.unit_price) / so.subtotal else 0 end +
      ((sri.quantity * sri.unit_price) -
        case when so.subtotal > 0 then so.discount * (sri.quantity * sri.unit_price) / so.subtotal else 0 end
      ) * so.vat_rate / 100,
      2
    )
  from public.sales_returns sr
  join public.sales_orders so on so.id = sr.sales_order_id and so.business_id = sr.business_id
  where sri.sales_return_id = v_return_id
    and sr.id = v_return_id;

  select
    coalesce(sum(sri.quantity * sri.unit_price), 0),
    coalesce(sum(sri.discount_amount), 0),
    coalesce(sum(sri.vat_amount), 0),
    coalesce(sum(sri.net_line_total), 0)
  into v_subtotal, v_discount, v_vat, v_total
  from public.sales_return_items sri
  where sri.sales_return_id = v_return_id and sri.business_id = p_business_id;

  select sr.sales_order_id, so.total
  into v_order_id, v_order_total
  from public.sales_returns sr
  join public.sales_orders so on so.id = sr.sales_order_id and so.business_id = sr.business_id
  where sr.id = v_return_id and sr.business_id = p_business_id
  for update of so;

  select coalesce(sum(pa.amount), 0)
  into v_paid
  from public.payment_allocations pa
  join public.finance_transactions ft
    on ft.id = pa.transaction_id and ft.business_id = pa.business_id
  where pa.business_id = p_business_id
    and pa.document_type = 'sales_order'
    and pa.document_id = v_order_id
    and ft.status = 'posted'
    and ft.reference_type = 'sales_order';

  select coalesce(sum(coalesce(sr.net_total, sr.total, 0)), 0)
  into v_returned
  from public.sales_returns sr
  where sr.business_id = p_business_id
    and sr.sales_order_id = v_order_id
    and lower(coalesce(sr.status, 'completed')) not in ('cancelled', 'canceled', 'draft');

  select coalesce(sum(ft.amount), 0)
  into v_prior_settled
  from public.finance_transactions ft
  join public.sales_returns sr
    on sr.id = ft.reference_id and sr.business_id = ft.business_id
  where ft.business_id = p_business_id
    and ft.reference_type = 'sales_return'
    and ft.status = 'posted'
    and sr.sales_order_id = v_order_id;

  v_cash_available := greatest(0, v_paid - greatest(0, v_order_total - v_returned) - v_prior_settled);

  v_code := public.take_document_code(p_business_id, 'sales_return', 'THB-');
  v_requested := coalesce(nullif(p_return->>'refund_amount', '')::numeric, v_total);
  if v_requested < 0 or v_requested > v_total then
    raise exception 'Số tiền hoàn không hợp lệ.';
  end if;
  if v_refund_now and v_requested > v_cash_available then
    raise exception 'Số tiền hoàn vượt quá phần khách đã thanh toán sau khi trừ công nợ còn lại.';
  end if;
  if v_refund_now and v_requested > 0 and v_account_id is null then
    raise exception 'Cần chọn tài khoản chi hoàn tiền.';
  end if;

  update public.sales_returns
  set code = v_code,
      subtotal = round(v_subtotal, 2),
      discount = round(v_discount, 2),
      vat_amount = round(v_vat, 2),
      total = round(v_total, 2),
      net_total = round(v_total, 2),
      refund_amount = round(v_requested, 2),
      refunded_amount = case when v_refund_now then round(v_requested, 2) else 0 end,
      refund_status = case when v_refund_now and v_requested > 0 then 'refunded' else 'pending' end
  where id = v_return_id and business_id = p_business_id;

  if v_refund_now and v_requested > 0 then
    if not exists (
      select 1 from public.finance_accounts
      where id = v_account_id and business_id = p_business_id and active = true
    ) then raise exception 'Tài khoản hoàn tiền không hợp lệ.'; end if;

    insert into public.finance_transactions (
      business_id, transaction_date, direction, category, account_id, amount,
      payment_method, reference_type, reference_id, note, status, created_by
    ) values (
      p_business_id, current_date, 'out', 'Hoàn tiền trả hàng', v_account_id, v_requested,
      coalesce(nullif(p_return->>'payment_method', ''), 'cash'), 'sales_return', v_return_id,
      nullif(p_return->>'note', ''), 'posted', auth.uid()
    ) returning * into v_transaction;
  end if;

  return jsonb_build_object(
    'id', v_return_id, 'code', v_code, 'total', round(v_total, 2),
    'refund_amount', round(v_requested, 2), 'refund_status',
    case when v_refund_now and v_requested > 0 then 'refunded' else 'pending' end
  );
end;
$$;

create or replace function public.app_create_purchase_return(
  p_business_id uuid,
  p_return jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_return_id uuid;
  v_code text;
  v_subtotal numeric;
  v_discount numeric;
  v_vat numeric;
  v_total numeric;
  v_requested numeric;
  v_order_id uuid;
  v_order_total numeric;
  v_paid numeric;
  v_returned numeric;
  v_prior_settled numeric;
  v_cash_available numeric;
  v_refund_now boolean := coalesce((p_return->>'refund_now')::boolean, false);
  v_account_id uuid := nullif(p_return->>'account_id', '')::uuid;
  v_transaction public.finance_transactions%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'purchase_return');
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Phiếu trả phải có ít nhất một sản phẩm.';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <>
     (select count(distinct nullif(value->>'product_id', '')) from jsonb_array_elements(p_items)) then
    raise exception 'Mỗi sản phẩm chỉ được xuất hiện một lần trong phiếu trả.';
  end if;

  v_result := public.create_purchase_return(
    p_business_id,
    (p_return - 'refund_now' - 'refund_amount' - 'account_id' - 'payment_method') || jsonb_build_object('refund_now', false),
    p_items
  );
  v_return_id := (v_result->>'id')::uuid;

  update public.purchase_return_items pri
  set
    discount_amount = round(
      case when po.subtotal > 0 then po.discount * (pri.quantity * pri.unit_cost) / po.subtotal else 0 end,
      2
    ),
    vat_amount = round(
      ((pri.quantity * pri.unit_cost) -
        case when po.subtotal > 0 then po.discount * (pri.quantity * pri.unit_cost) / po.subtotal else 0 end
      ) * po.vat_rate / 100,
      2
    ),
    net_line_total = round(
      (pri.quantity * pri.unit_cost) -
      case when po.subtotal > 0 then po.discount * (pri.quantity * pri.unit_cost) / po.subtotal else 0 end +
      ((pri.quantity * pri.unit_cost) -
        case when po.subtotal > 0 then po.discount * (pri.quantity * pri.unit_cost) / po.subtotal else 0 end
      ) * po.vat_rate / 100,
      2
    )
  from public.purchase_returns pr
  join public.purchase_orders po on po.id = pr.purchase_order_id and po.business_id = pr.business_id
  where pri.purchase_return_id = v_return_id
    and pr.id = v_return_id;

  select
    coalesce(sum(pri.quantity * pri.unit_cost), 0),
    coalesce(sum(pri.discount_amount), 0),
    coalesce(sum(pri.vat_amount), 0),
    coalesce(sum(pri.net_line_total), 0)
  into v_subtotal, v_discount, v_vat, v_total
  from public.purchase_return_items pri
  where pri.purchase_return_id = v_return_id and pri.business_id = p_business_id;

  select pr.purchase_order_id, po.total
  into v_order_id, v_order_total
  from public.purchase_returns pr
  join public.purchase_orders po on po.id = pr.purchase_order_id and po.business_id = pr.business_id
  where pr.id = v_return_id and pr.business_id = p_business_id
  for update of po;

  select coalesce(sum(pa.amount), 0)
  into v_paid
  from public.payment_allocations pa
  join public.finance_transactions ft
    on ft.id = pa.transaction_id and ft.business_id = pa.business_id
  where pa.business_id = p_business_id
    and pa.document_type = 'purchase_order'
    and pa.document_id = v_order_id
    and ft.status = 'posted'
    and ft.reference_type = 'purchase_order';

  select coalesce(sum(coalesce(pr.net_total, pr.total, 0)), 0)
  into v_returned
  from public.purchase_returns pr
  where pr.business_id = p_business_id
    and pr.purchase_order_id = v_order_id
    and lower(coalesce(pr.status, 'completed')) not in ('cancelled', 'canceled', 'draft');

  select coalesce(sum(ft.amount), 0)
  into v_prior_settled
  from public.finance_transactions ft
  join public.purchase_returns pr
    on pr.id = ft.reference_id and pr.business_id = ft.business_id
  where ft.business_id = p_business_id
    and ft.reference_type = 'purchase_return'
    and ft.status = 'posted'
    and pr.purchase_order_id = v_order_id;

  v_cash_available := greatest(0, v_paid - greatest(0, v_order_total - v_returned) - v_prior_settled);

  v_code := public.take_document_code(p_business_id, 'purchase_return', 'THN-');
  v_requested := coalesce(nullif(p_return->>'refund_amount', '')::numeric, v_total);
  if v_requested < 0 or v_requested > v_total then
    raise exception 'Số tiền nhận lại không hợp lệ.';
  end if;
  if v_refund_now and v_requested > v_cash_available then
    raise exception 'Số tiền nhận lại vượt quá phần đã thanh toán cho nhà cung cấp sau khi trừ công nợ còn lại.';
  end if;
  if v_refund_now and v_requested > 0 and v_account_id is null then
    raise exception 'Cần chọn tài khoản nhận tiền từ nhà cung cấp.';
  end if;

  update public.purchase_returns
  set code = v_code,
      subtotal = round(v_subtotal, 2),
      discount = round(v_discount, 2),
      vat_amount = round(v_vat, 2),
      total = round(v_total, 2),
      net_total = round(v_total, 2),
      refund_amount = round(v_requested, 2),
      refunded_amount = case when v_refund_now then round(v_requested, 2) else 0 end,
      refund_status = case when v_refund_now and v_requested > 0 then 'refunded' else 'pending' end
  where id = v_return_id and business_id = p_business_id;

  if v_refund_now and v_requested > 0 then
    if not exists (
      select 1 from public.finance_accounts
      where id = v_account_id and business_id = p_business_id and active = true
    ) then raise exception 'Tài khoản nhận tiền không hợp lệ.'; end if;

    insert into public.finance_transactions (
      business_id, transaction_date, direction, category, account_id, amount,
      payment_method, reference_type, reference_id, note, status, created_by
    ) values (
      p_business_id, current_date, 'in', 'Nhận tiền trả hàng', v_account_id, v_requested,
      coalesce(nullif(p_return->>'payment_method', ''), 'cash'), 'purchase_return', v_return_id,
      nullif(p_return->>'note', ''), 'posted', auth.uid()
    ) returning * into v_transaction;
  end if;

  return jsonb_build_object(
    'id', v_return_id, 'code', v_code, 'total', round(v_total, 2),
    'refund_amount', round(v_requested, 2), 'refund_status',
    case when v_refund_now and v_requested > 0 then 'refunded' else 'pending' end
  );
end;
$$;

create or replace function public.app_settle_return(
  p_business_id uuid,
  p_return_type text,
  p_return_id uuid,
  p_amount numeric,
  p_account_id uuid,
  p_payment_method text default 'cash',
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total numeric;
  v_settled numeric;
  v_direction text;
  v_reference_type text;
  v_category text;
  v_status text;
  v_order_id uuid;
  v_order_total numeric;
  v_paid numeric;
  v_returned numeric;
  v_all_settled numeric;
  v_cash_available numeric;
  v_transaction public.finance_transactions%rowtype;
begin
  if lower(p_return_type) = 'sales' then
    perform public.assert_business_permission(p_business_id, 'sales_return');
    select coalesce(net_total, total, 0), status, sales_order_id into v_total, v_status, v_order_id
    from public.sales_returns where id = p_return_id and business_id = p_business_id for update;
    select total into v_order_total from public.sales_orders
    where id = v_order_id and business_id = p_business_id for update;
    v_direction := 'out'; v_reference_type := 'sales_return'; v_category := 'Hoàn tiền trả hàng';
  elsif lower(p_return_type) = 'purchase' then
    perform public.assert_business_permission(p_business_id, 'purchase_return');
    select coalesce(net_total, total, 0), status, purchase_order_id into v_total, v_status, v_order_id
    from public.purchase_returns where id = p_return_id and business_id = p_business_id for update;
    select total into v_order_total from public.purchase_orders
    where id = v_order_id and business_id = p_business_id for update;
    v_direction := 'in'; v_reference_type := 'purchase_return'; v_category := 'Nhận tiền trả hàng';
  else
    raise exception 'Loại phiếu trả hàng không hợp lệ.';
  end if;

  if v_total is null then raise exception 'Không tìm thấy phiếu trả hàng.'; end if;
  if lower(coalesce(v_status, '')) in ('cancelled', 'canceled', 'draft') then
    raise exception 'Phiếu trả hàng không hợp lệ để đối soát.';
  end if;
  select coalesce(sum(amount), 0) into v_settled
  from public.finance_transactions
  where business_id = p_business_id and reference_type = v_reference_type
    and reference_id = p_return_id and status = 'posted';

  if lower(p_return_type) = 'sales' then
    select coalesce(sum(pa.amount), 0) into v_paid
    from public.payment_allocations pa
    join public.finance_transactions ft on ft.id = pa.transaction_id and ft.business_id = pa.business_id
    where pa.business_id = p_business_id and pa.document_type = 'sales_order'
      and pa.document_id = v_order_id and ft.status = 'posted' and ft.reference_type = 'sales_order';
    select coalesce(sum(coalesce(net_total, total, 0)), 0) into v_returned
    from public.sales_returns
    where business_id = p_business_id and sales_order_id = v_order_id
      and lower(coalesce(status, 'completed')) not in ('cancelled', 'canceled', 'draft');
    select coalesce(sum(ft.amount), 0) into v_all_settled
    from public.finance_transactions ft
    join public.sales_returns sr on sr.id = ft.reference_id and sr.business_id = ft.business_id
    where ft.business_id = p_business_id and ft.reference_type = 'sales_return'
      and ft.status = 'posted' and sr.sales_order_id = v_order_id;
  else
    select coalesce(sum(pa.amount), 0) into v_paid
    from public.payment_allocations pa
    join public.finance_transactions ft on ft.id = pa.transaction_id and ft.business_id = pa.business_id
    where pa.business_id = p_business_id and pa.document_type = 'purchase_order'
      and pa.document_id = v_order_id and ft.status = 'posted' and ft.reference_type = 'purchase_order';
    select coalesce(sum(coalesce(net_total, total, 0)), 0) into v_returned
    from public.purchase_returns
    where business_id = p_business_id and purchase_order_id = v_order_id
      and lower(coalesce(status, 'completed')) not in ('cancelled', 'canceled', 'draft');
    select coalesce(sum(ft.amount), 0) into v_all_settled
    from public.finance_transactions ft
    join public.purchase_returns pr on pr.id = ft.reference_id and pr.business_id = ft.business_id
    where ft.business_id = p_business_id and ft.reference_type = 'purchase_return'
      and ft.status = 'posted' and pr.purchase_order_id = v_order_id;
  end if;
  v_cash_available := greatest(0, v_paid - greatest(0, v_order_total - v_returned) - v_all_settled);

  if p_amount is null or p_amount <= 0
    or p_amount > greatest(0, v_total - v_settled)
    or p_amount > v_cash_available then
    raise exception 'Số tiền đối soát không hợp lệ hoặc vượt quá số còn lại.';
  end if;
  if not exists (
    select 1 from public.finance_accounts
    where id = p_account_id and business_id = p_business_id and active = true
  ) then raise exception 'Tài khoản tiền không hợp lệ.'; end if;

  insert into public.finance_transactions (
    business_id, transaction_date, direction, category, account_id, amount,
    payment_method, reference_type, reference_id, note, status, created_by
  ) values (
    p_business_id, current_date, v_direction, v_category, p_account_id, p_amount,
    coalesce(nullif(p_payment_method, ''), 'cash'), v_reference_type, p_return_id,
    nullif(p_note, ''), 'posted', auth.uid()
  ) returning * into v_transaction;

  v_settled := v_settled + p_amount;
  if lower(p_return_type) = 'sales' then
    update public.sales_returns set refunded_amount = v_settled,
      refund_status = case when v_settled >= v_total then 'refunded' else 'pending' end
    where id = p_return_id and business_id = p_business_id;
  else
    update public.purchase_returns set refunded_amount = v_settled,
      refund_status = case when v_settled >= v_total then 'refunded' else 'pending' end
    where id = p_return_id and business_id = p_business_id;
  end if;

  return to_jsonb(v_transaction) || jsonb_build_object(
    'settled_amount', v_settled,
    'remaining_amount', greatest(0, v_total - v_settled)
  );
end;
$$;

create or replace function public.app_create_stock_adjustment(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_unit_cost numeric default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_product public.products%rowtype;
  v_allow_negative boolean := false;
  v_movement public.stock_movements%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'inventory');
  if p_quantity is null or p_quantity = 0 then raise exception 'Số lượng điều chỉnh phải khác 0.'; end if;
  if nullif(trim(coalesce(p_note, '')), '') is null then raise exception 'Cần ghi rõ lý do điều chỉnh.'; end if;

  select * into v_product from public.products
  where id = p_product_id and business_id = p_business_id and active = true
  for update;
  if not found or v_product.product_type = 'service' then raise exception 'Sản phẩm điều chỉnh không hợp lệ.'; end if;

  select coalesce((
    select allow_negative_stock from public.app_settings where business_id = p_business_id
  ), false) into v_allow_negative;
  if not v_allow_negative and v_product.stock_on_hand + p_quantity < 0 then
    raise exception 'Điều chỉnh này làm tồn kho bị âm.';
  end if;

  insert into public.stock_movements (
    business_id, product_id, movement_type, quantity, unit_cost,
    reference_type, note, created_by
  ) values (
    p_business_id, p_product_id, 'adjustment', p_quantity,
    coalesce(p_unit_cost, v_product.cost_price), 'manual', trim(p_note), auth.uid()
  ) returning * into v_movement;
  return to_jsonb(v_movement);
end;
$$;

create or replace function public.app_create_stocktake(
  p_business_id uuid,
  p_stocktake jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
  v_id uuid;
  v_code text;
begin
  perform public.assert_business_permission(p_business_id, 'inventory');
  v_result := public.create_stocktake(p_business_id, p_stocktake, p_items);
  v_id := (v_result->>'id')::uuid;
  v_code := public.take_document_code(p_business_id, 'stocktake', 'KK-');
  update public.stocktakes set code = v_code where id = v_id and business_id = p_business_id;
  update public.stock_movements
  set note = 'Cân đối theo phiếu kiểm kê ' || v_code
  where business_id = p_business_id and reference_type = 'stocktake' and reference_id = v_id;
  return v_result || jsonb_build_object('code', v_code);
end;
$$;

-- Cancel confirmed documents by reversing payments and inventory in one transaction.
create or replace function public.app_cancel_sales_order(
  p_business_id uuid,
  p_sales_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.sales_orders%rowtype;
  v_tx public.finance_transactions%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'sales');
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'Cần ghi rõ lý do hủy đơn.'; end if;
  select * into v_order from public.sales_orders
  where id = p_sales_order_id and business_id = p_business_id for update;
  if not found then raise exception 'Không tìm thấy đơn bán.'; end if;
  if v_order.status = 'cancelled' then return to_jsonb(v_order); end if;
  if exists (
    select 1 from public.sales_returns
    where sales_order_id = p_sales_order_id and business_id = p_business_id
      and lower(coalesce(status, 'completed')) not in ('cancelled', 'canceled', 'draft')
  ) then raise exception 'Không thể hủy đơn đã phát sinh trả hàng.'; end if;

  for v_tx in
    select ft.*
    from public.finance_transactions ft
    where ft.id in (
      select pa.transaction_id from public.payment_allocations pa
      where pa.business_id = p_business_id and pa.document_type = 'sales_order'
        and pa.document_id = p_sales_order_id
    ) and ft.status = 'posted'
    for update of ft
  loop
    insert into public.finance_transactions (
      business_id, transaction_date, direction, category, account_id, amount,
      payment_method, reference_type, reference_id, note, status, created_by
    ) values (
      p_business_id, current_date, 'out', 'Đảo thu khi hủy đơn', v_tx.account_id, v_tx.amount,
      v_tx.payment_method, 'sales_order_reversal', p_sales_order_id,
      trim(p_reason), 'posted', auth.uid()
    );
  end loop;

  insert into public.stock_movements (
    business_id, product_id, movement_type, quantity, unit_cost,
    reference_type, reference_id, note, created_by
  )
  select soi.business_id, soi.product_id, 'adjustment', soi.quantity, soi.unit_cost,
    'sales_order_cancel', soi.sales_order_id, 'Hoàn kho do hủy đơn ' || v_order.code || ': ' || trim(p_reason), auth.uid()
  from public.sales_order_items soi
  join public.products p on p.id = soi.product_id and p.business_id = soi.business_id
  where soi.business_id = p_business_id and soi.sales_order_id = p_sales_order_id
    and p.product_type <> 'service';

  update public.sales_orders set status = 'cancelled', note = concat_ws(E'\n', note, 'Hủy: ' || trim(p_reason))
  where id = p_sales_order_id and business_id = p_business_id
  returning * into v_order;
  return to_jsonb(v_order);
end;
$$;

create or replace function public.app_cancel_purchase_order(
  p_business_id uuid,
  p_purchase_order_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_tx public.finance_transactions%rowtype;
  v_allow_negative boolean := false;
begin
  perform public.assert_business_permission(p_business_id, 'purchases');
  if nullif(trim(coalesce(p_reason, '')), '') is null then raise exception 'Cần ghi rõ lý do hủy phiếu.'; end if;
  select * into v_order from public.purchase_orders
  where id = p_purchase_order_id and business_id = p_business_id for update;
  if not found then raise exception 'Không tìm thấy phiếu nhập.'; end if;
  if v_order.status = 'cancelled' then return to_jsonb(v_order); end if;
  if exists (
    select 1 from public.purchase_returns
    where purchase_order_id = p_purchase_order_id and business_id = p_business_id
      and lower(coalesce(status, 'completed')) not in ('cancelled', 'canceled', 'draft')
  ) then raise exception 'Không thể hủy phiếu đã phát sinh trả hàng.'; end if;

  select coalesce((
    select allow_negative_stock from public.app_settings where business_id = p_business_id
  ), false) into v_allow_negative;
  perform 1
  from public.products p
  where p.business_id = p_business_id
    and p.id in (
      select poi.product_id
      from public.purchase_order_items poi
      where poi.business_id = p_business_id and poi.purchase_order_id = p_purchase_order_id
    )
  order by p.id
  for update;
  if not v_allow_negative and exists (
    select 1
    from public.purchase_order_items poi
    join public.products p on p.id = poi.product_id and p.business_id = poi.business_id
    where poi.business_id = p_business_id and poi.purchase_order_id = p_purchase_order_id
      and p.product_type <> 'service' and p.stock_on_hand < poi.quantity
  ) then raise exception 'Không thể hủy vì một số hàng trong phiếu đã được xuất khỏi kho.'; end if;

  for v_tx in
    select ft.*
    from public.finance_transactions ft
    where ft.id in (
      select pa.transaction_id from public.payment_allocations pa
      where pa.business_id = p_business_id and pa.document_type = 'purchase_order'
        and pa.document_id = p_purchase_order_id
    ) and ft.status = 'posted'
    for update of ft
  loop
    insert into public.finance_transactions (
      business_id, transaction_date, direction, category, account_id, amount,
      payment_method, reference_type, reference_id, note, status, created_by
    ) values (
      p_business_id, current_date, 'in', 'Đảo chi khi hủy phiếu nhập', v_tx.account_id, v_tx.amount,
      v_tx.payment_method, 'purchase_order_reversal', p_purchase_order_id,
      trim(p_reason), 'posted', auth.uid()
    );
  end loop;

  insert into public.stock_movements (
    business_id, product_id, movement_type, quantity, unit_cost,
    reference_type, reference_id, note, created_by
  )
  select poi.business_id, poi.product_id, 'adjustment', -poi.quantity, poi.unit_cost,
    'purchase_order_cancel', poi.purchase_order_id, 'Trừ kho do hủy phiếu ' || v_order.code || ': ' || trim(p_reason), auth.uid()
  from public.purchase_order_items poi
  join public.products p on p.id = poi.product_id and p.business_id = poi.business_id
  where poi.business_id = p_business_id and poi.purchase_order_id = p_purchase_order_id
    and p.product_type <> 'service';

  update public.purchase_orders set status = 'cancelled', note = concat_ws(E'\n', note, 'Hủy: ' || trim(p_reason))
  where id = p_purchase_order_id and business_id = p_business_id
  returning * into v_order;
  return to_jsonb(v_order);
end;
$$;

create or replace function public.app_update_quote_status(
  p_business_id uuid,
  p_quote_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.quotes%rowtype;
  v_next text := lower(coalesce(p_status, ''));
begin
  perform public.assert_business_permission(p_business_id, 'quotes');
  if v_next not in ('draft', 'sent', 'accepted', 'expired', 'cancelled') then
    raise exception 'Trạng thái báo giá không hợp lệ.';
  end if;
  select * into v_quote from public.quotes
  where id = p_quote_id and business_id = p_business_id for update;
  if not found then raise exception 'Không tìm thấy báo giá.'; end if;
  if v_quote.converted_sales_order_id is not null and v_next <> 'accepted' then
    raise exception 'Báo giá đã chuyển thành đơn bán nên không thể đổi trạng thái.';
  end if;
  update public.quotes set status = v_next
  where id = p_quote_id and business_id = p_business_id
  returning * into v_quote;
  return to_jsonb(v_quote);
end;
$$;

create or replace function public.app_convert_quote_to_sales(
  p_business_id uuid,
  p_quote_id uuid,
  p_order_date date default current_date,
  p_due_date date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_quote public.quotes%rowtype;
  v_items jsonb;
  v_order jsonb;
begin
  perform public.assert_business_permission(p_business_id, 'sales');
  select * into v_quote from public.quotes
  where id = p_quote_id and business_id = p_business_id for update;
  if not found then raise exception 'Không tìm thấy báo giá.'; end if;
  if v_quote.converted_sales_order_id is not null then raise exception 'Báo giá đã được chuyển thành đơn bán.'; end if;
  if lower(v_quote.status) in ('cancelled', 'expired') then raise exception 'Báo giá không còn hiệu lực.'; end if;

  select jsonb_agg(jsonb_build_object(
    'product_id', qi.product_id,
    'quantity', qi.quantity,
    'unit_price', qi.unit_price,
    'note', qi.note
  ) order by qi.id)
  into v_items
  from public.quote_items qi
  where qi.quote_id = p_quote_id and qi.business_id = p_business_id;

  v_order := public.app_create_sales_order(
    p_business_id,
    jsonb_build_object(
      'customer_id', v_quote.customer_id,
      'order_date', coalesce(p_order_date, current_date),
      'due_date', p_due_date,
      'discount', v_quote.discount,
      'shipping_fee', v_quote.shipping_fee,
      'vat_rate', v_quote.vat_rate,
      'note', concat_ws(' ', 'Chuyển từ báo giá', v_quote.code),
      'channel', 'sales'
    ),
    coalesce(v_items, '[]'::jsonb)
  );

  update public.quotes
  set status = 'accepted', converted_sales_order_id = (v_order->>'id')::uuid
  where id = p_quote_id and business_id = p_business_id;
  return v_order;
end;
$$;

-- Only the hardened mutation endpoints are callable from the browser.
revoke execute on function public.create_sales_order(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.record_sales_payment(uuid, uuid, numeric, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.create_purchase_order(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.record_purchase_payment(uuid, uuid, numeric, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.create_quote(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.create_sales_return(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.create_purchase_return(uuid, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.create_stocktake(uuid, jsonb, jsonb) from public, anon, authenticated;

revoke execute on function public.business_role(uuid) from public, anon;
revoke execute on function public.has_business_permission(uuid, text) from public, anon;
revoke execute on function public.assert_business_permission(uuid, text) from public, anon, authenticated;
revoke execute on function public.take_document_code(uuid, text, text) from public, anon, authenticated;

revoke execute on function public.app_create_sales_order(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.app_record_sales_payment(uuid, uuid, numeric, uuid, text, text) from public, anon;
revoke execute on function public.app_create_pos_sale(uuid, jsonb, jsonb, uuid, text) from public, anon;
revoke execute on function public.app_create_purchase_order(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.app_record_purchase_payment(uuid, uuid, numeric, uuid, text, text) from public, anon;
revoke execute on function public.app_create_quote(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.app_create_sales_return(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.app_create_purchase_return(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.app_settle_return(uuid, text, uuid, numeric, uuid, text, text) from public, anon;
revoke execute on function public.app_create_stock_adjustment(uuid, uuid, numeric, numeric, text) from public, anon;
revoke execute on function public.app_create_stocktake(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.app_cancel_sales_order(uuid, uuid, text) from public, anon;
revoke execute on function public.app_cancel_purchase_order(uuid, uuid, text) from public, anon;
revoke execute on function public.app_update_quote_status(uuid, uuid, text) from public, anon;
revoke execute on function public.app_convert_quote_to_sales(uuid, uuid, date, date) from public, anon;

grant execute on function public.business_role(uuid) to authenticated;
grant execute on function public.has_business_permission(uuid, text) to authenticated;
grant execute on function public.app_create_sales_order(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.app_record_sales_payment(uuid, uuid, numeric, uuid, text, text) to authenticated;
grant execute on function public.app_create_pos_sale(uuid, jsonb, jsonb, uuid, text) to authenticated;
grant execute on function public.app_create_purchase_order(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.app_record_purchase_payment(uuid, uuid, numeric, uuid, text, text) to authenticated;
grant execute on function public.app_create_quote(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.app_create_sales_return(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.app_create_purchase_return(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.app_settle_return(uuid, text, uuid, numeric, uuid, text, text) to authenticated;
grant execute on function public.app_create_stock_adjustment(uuid, uuid, numeric, numeric, text) to authenticated;
grant execute on function public.app_create_stocktake(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.app_cancel_sales_order(uuid, uuid, text) to authenticated;
grant execute on function public.app_cancel_purchase_order(uuid, uuid, text) to authenticated;
grant execute on function public.app_update_quote_status(uuid, uuid, text) to authenticated;
grant execute on function public.app_convert_quote_to_sales(uuid, uuid, date, date) to authenticated;

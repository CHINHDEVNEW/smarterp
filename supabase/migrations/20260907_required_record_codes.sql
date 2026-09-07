begin;

-- Codes are database-required identifiers, but users may leave them blank because
-- SmartERP owns their generation. Keeping this at the database boundary also
-- covers RPC inserts and prevents concurrent clients from producing duplicates.
create or replace function public.assign_required_record_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entity text;
  v_fallback_prefix text;
begin
  case tg_table_name
    when 'customers' then
      v_entity := 'customer';
      v_fallback_prefix := 'KH-';
    when 'suppliers' then
      v_entity := 'supplier';
      v_fallback_prefix := 'NCC-';
    when 'sales_orders' then
      v_entity := 'sales_order';
      v_fallback_prefix := 'DH-';
    when 'purchase_orders' then
      v_entity := 'purchase_order';
      v_fallback_prefix := 'PN-';
    when 'quotes' then
      v_entity := 'quote';
      v_fallback_prefix := 'BG-';
    else
      raise exception 'Bảng % không hỗ trợ tự sinh mã.', tg_table_name;
  end case;

  if nullif(btrim(new.code), '') is null then
    new.code := public.take_document_code(new.business_id, v_entity, v_fallback_prefix);
  else
    new.code := upper(btrim(new.code));
  end if;

  return new;
end;
$$;

revoke all on function public.assign_required_record_code() from public, anon, authenticated;

drop trigger if exists assign_customer_code_before_insert on public.customers;
create trigger assign_customer_code_before_insert
before insert on public.customers
for each row execute function public.assign_required_record_code();

drop trigger if exists assign_supplier_code_before_insert on public.suppliers;
create trigger assign_supplier_code_before_insert
before insert on public.suppliers
for each row execute function public.assign_required_record_code();

drop trigger if exists assign_sales_order_code_before_insert on public.sales_orders;
create trigger assign_sales_order_code_before_insert
before insert on public.sales_orders
for each row execute function public.assign_required_record_code();

drop trigger if exists assign_purchase_order_code_before_insert on public.purchase_orders;
create trigger assign_purchase_order_code_before_insert
before insert on public.purchase_orders
for each row execute function public.assign_required_record_code();

drop trigger if exists assign_quote_code_before_insert on public.quotes;
create trigger assign_quote_code_before_insert
before insert on public.quotes
for each row execute function public.assign_required_record_code();

commit;

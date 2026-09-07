begin;

-- Keep legacy NOT NULL partner snapshots populated while allowing walk-in
-- customers and purchase orders without a selected supplier.
create or replace function public.assign_required_record_code()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entity text;
  v_fallback_prefix text;
  v_partner_name text;
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

  if tg_table_name = 'purchase_orders' then
    if new.supplier_id is null then
      new.supplier_name := 'Không chọn nhà cung cấp';
    else
      select s.name
      into v_partner_name
      from public.suppliers s
      where s.id = new.supplier_id
        and s.business_id = new.business_id;

      if v_partner_name is null then
        raise exception 'Nhà cung cấp không thuộc doanh nghiệp hiện tại.';
      end if;
      new.supplier_name := v_partner_name;
    end if;
  elsif tg_table_name in ('sales_orders', 'quotes') then
    if new.customer_id is null then
      new.customer_name := 'Khách lẻ';
    else
      select c.name
      into v_partner_name
      from public.customers c
      where c.id = new.customer_id
        and c.business_id = new.business_id;

      if v_partner_name is null then
        raise exception 'Khách hàng không thuộc doanh nghiệp hiện tại.';
      end if;
      new.customer_name := v_partner_name;
    end if;
  end if;

  -- These functions post stock immediately, so the legacy schema's completed
  -- state is the correct persisted value. "confirmed" is not accepted there.
  if tg_table_name in ('sales_orders', 'purchase_orders') then
    if lower(btrim(coalesce(to_jsonb(new)->>'status', ''))) = 'confirmed' then
      new := jsonb_populate_record(new, jsonb_build_object('status', 'completed'));
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.assign_required_record_code() from public, anon, authenticated;

commit;

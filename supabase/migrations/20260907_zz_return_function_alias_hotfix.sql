begin;

-- The deployed legacy return functions build item INSERT statements with r.*
-- expressions but omitted the r alias after jsonb_populate_record(). Patch the
-- stored definitions in place so existing databases do not need to rerun the
-- entire historical migration.
do $$
declare
  v_definition text;
  v_old text;
  v_new text;
begin
  select pg_get_functiondef('public.create_sales_return(uuid,jsonb,jsonb)'::regprocedure)
  into v_definition;
  v_old := 'from jsonb_populate_record(null::public.sales_return_items, $1)';
  v_new := 'from jsonb_populate_record(null::public.sales_return_items, $1) r';
  if strpos(v_definition, v_new) > 0 then
    null;
  elsif strpos(v_definition, v_old) = 0 then
    raise exception 'Không tìm thấy đoạn SQL cần sửa trong create_sales_return.';
  else
    execute replace(v_definition, v_old, v_new);
  end if;

  select pg_get_functiondef('public.create_purchase_return(uuid,jsonb,jsonb)'::regprocedure)
  into v_definition;
  v_old := 'from jsonb_populate_record(null::public.purchase_return_items, $1)';
  v_new := 'from jsonb_populate_record(null::public.purchase_return_items, $1) r';
  if strpos(v_definition, v_new) > 0 then
    null;
  elsif strpos(v_definition, v_old) = 0 then
    raise exception 'Không tìm thấy đoạn SQL cần sửa trong create_purchase_return.';
  else
    execute replace(v_definition, v_old, v_new);
  end if;
end;
$$;

commit;

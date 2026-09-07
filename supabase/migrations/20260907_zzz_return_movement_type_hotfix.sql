begin;

-- Older stock_movements constraints accept adjustment but not return. The
-- reference_type continues to distinguish customer and supplier returns.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.create_sales_return(uuid,jsonb,jsonb)'::regprocedure)
  into v_definition;
  if strpos(v_definition, '''return'', v_quantity') > 0 then
    execute replace(v_definition, '''return'', v_quantity', '''adjustment'', v_quantity');
  elsif strpos(v_definition, '''adjustment'', v_quantity') = 0 then
    raise exception 'Không tìm thấy movement_type cần sửa trong create_sales_return.';
  end if;

  select pg_get_functiondef('public.create_purchase_return(uuid,jsonb,jsonb)'::regprocedure)
  into v_definition;
  if strpos(v_definition, '''return'', -v_quantity') > 0 then
    execute replace(v_definition, '''return'', -v_quantity', '''adjustment'', -v_quantity');
  elsif strpos(v_definition, '''adjustment'', -v_quantity') = 0 then
    raise exception 'Không tìm thấy movement_type cần sửa trong create_purchase_return.';
  end if;
end;
$$;

commit;

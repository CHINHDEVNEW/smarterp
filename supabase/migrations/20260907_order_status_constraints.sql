begin;

-- Preserve every status already stored by the legacy database, then add the
-- canonical SmartERP states used by current RPCs and UI. This changes only the
-- constraint; existing documents are not rewritten.
do $$
declare
  v_table_name text;
  v_constraint_name text;
  v_existing_statuses text[];
  v_allowed_statuses text[];
begin
  for v_table_name, v_constraint_name in
    values
      ('purchase_orders', 'purchase_orders_status_check'),
      ('sales_orders', 'sales_orders_status_check')
  loop
    execute format(
      'select array_agg(distinct lower(btrim(status::text)))
       from public.%I
       where nullif(btrim(status::text), '''') is not null',
      v_table_name
    )
    into v_existing_statuses;

    select array_agg(distinct status_value order by status_value)
    into v_allowed_statuses
    from unnest(
      coalesce(v_existing_statuses, array[]::text[])
      || array['draft', 'confirmed', 'completed', 'cancelled']
    ) as status_value;

    execute format(
      'alter table public.%I drop constraint if exists %I',
      v_table_name,
      v_constraint_name
    );

    execute format(
      'alter table public.%I add constraint %I
       check (lower(btrim(status::text)) = any (%L::text[]))',
      v_table_name,
      v_constraint_name,
      v_allowed_statuses
    );
  end loop;
end;
$$;

commit;

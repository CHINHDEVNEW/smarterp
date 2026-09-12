begin;

-- The application uses `sales` for normal orders and `pos` for quick sales.
-- Keep channel extensible for future sales sources while still validating that
-- it is a compact machine-readable identifier.
alter table public.sales_orders
  drop constraint if exists sales_orders_channel_check;

update public.sales_orders
set channel = case
  when nullif(lower(btrim(channel)), '') is null then 'sales'
  when lower(btrim(channel)) ~ '^[a-z][a-z0-9_-]{0,29}$' then lower(btrim(channel))
  else 'sales'
end;

alter table public.sales_orders
  alter column channel set default 'sales',
  alter column channel set not null;

alter table public.sales_orders
  add constraint sales_orders_channel_check
  check (channel ~ '^[a-z][a-z0-9_-]{0,29}$');

commit;

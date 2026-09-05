-- Restrictive write guards for master data and settings.
-- Run after 20260906_core_hardening.sql.

alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.businesses enable row level security;
alter table public.app_settings enable row level security;
alter table public.document_sequences enable row level security;

drop policy if exists smarterp_products_insert_guard on public.products;
drop policy if exists smarterp_products_update_guard on public.products;
drop policy if exists smarterp_products_delete_guard on public.products;
create policy smarterp_products_insert_guard on public.products as restrictive for insert to authenticated
with check (public.business_role(business_id) in ('owner', 'admin', 'manager', 'warehouse', 'purchasing'));
create policy smarterp_products_update_guard on public.products as restrictive for update to authenticated
using (public.business_role(business_id) in ('owner', 'admin', 'manager', 'warehouse', 'purchasing'))
with check (public.business_role(business_id) in ('owner', 'admin', 'manager', 'warehouse', 'purchasing'));
create policy smarterp_products_delete_guard on public.products as restrictive for delete to authenticated
using (public.business_role(business_id) in ('owner', 'admin'));

drop policy if exists smarterp_customers_insert_guard on public.customers;
drop policy if exists smarterp_customers_update_guard on public.customers;
drop policy if exists smarterp_customers_delete_guard on public.customers;
create policy smarterp_customers_insert_guard on public.customers as restrictive for insert to authenticated
with check (public.has_business_permission(business_id, 'customers'));
create policy smarterp_customers_update_guard on public.customers as restrictive for update to authenticated
using (public.has_business_permission(business_id, 'customers'))
with check (public.has_business_permission(business_id, 'customers'));
create policy smarterp_customers_delete_guard on public.customers as restrictive for delete to authenticated
using (public.business_role(business_id) in ('owner', 'admin'));

drop policy if exists smarterp_suppliers_insert_guard on public.suppliers;
drop policy if exists smarterp_suppliers_update_guard on public.suppliers;
drop policy if exists smarterp_suppliers_delete_guard on public.suppliers;
create policy smarterp_suppliers_insert_guard on public.suppliers as restrictive for insert to authenticated
with check (public.has_business_permission(business_id, 'purchases'));
create policy smarterp_suppliers_update_guard on public.suppliers as restrictive for update to authenticated
using (public.has_business_permission(business_id, 'purchases'))
with check (public.has_business_permission(business_id, 'purchases'));
create policy smarterp_suppliers_delete_guard on public.suppliers as restrictive for delete to authenticated
using (public.business_role(business_id) in ('owner', 'admin'));

drop policy if exists smarterp_businesses_update_guard on public.businesses;
create policy smarterp_businesses_update_guard on public.businesses as restrictive for update to authenticated
using (public.business_role(id) in ('owner', 'admin'))
with check (public.business_role(id) in ('owner', 'admin'));

drop policy if exists smarterp_app_settings_insert_guard on public.app_settings;
drop policy if exists smarterp_app_settings_update_guard on public.app_settings;
drop policy if exists smarterp_app_settings_delete_guard on public.app_settings;
create policy smarterp_app_settings_insert_guard on public.app_settings as restrictive for insert to authenticated
with check (public.business_role(business_id) in ('owner', 'admin'));
create policy smarterp_app_settings_update_guard on public.app_settings as restrictive for update to authenticated
using (public.business_role(business_id) in ('owner', 'admin'))
with check (public.business_role(business_id) in ('owner', 'admin'));
create policy smarterp_app_settings_delete_guard on public.app_settings as restrictive for delete to authenticated
using (public.business_role(business_id) in ('owner', 'admin'));

drop policy if exists smarterp_sequences_insert_guard on public.document_sequences;
drop policy if exists smarterp_sequences_update_guard on public.document_sequences;
drop policy if exists smarterp_sequences_delete_guard on public.document_sequences;
create policy smarterp_sequences_insert_guard on public.document_sequences as restrictive for insert to authenticated
with check (public.business_role(business_id) in ('owner', 'admin'));
create policy smarterp_sequences_update_guard on public.document_sequences as restrictive for update to authenticated
using (public.business_role(business_id) in ('owner', 'admin'))
with check (public.business_role(business_id) in ('owner', 'admin'));
create policy smarterp_sequences_delete_guard on public.document_sequences as restrictive for delete to authenticated
using (public.business_role(business_id) in ('owner', 'admin'));

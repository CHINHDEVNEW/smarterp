-- SmartERP production module.
-- Neutral enough for small-batch manufacturing without introducing a factory MES.
-- Run after 20260906_core_hardening.sql and 20260906_catalog_settings_permissions.sql.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Master data: bills of material (BOM)
-- ---------------------------------------------------------------------------
create table if not exists public.production_boms (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  name text not null,
  output_product_id uuid not null references public.products(id) on delete restrict,
  output_quantity numeric(15,3) not null default 1 check (output_quantity > 0),
  version integer not null default 1 check (version > 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_bom_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  bom_id uuid not null references public.production_boms(id) on delete cascade,
  material_product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(15,6) not null check (quantity > 0),
  scrap_rate numeric(7,3) not null default 0 check (scrap_rate >= 0 and scrap_rate <= 100),
  unit text,
  unit_cost numeric(15,4) not null default 0 check (unit_cost >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists production_boms_business_code_key
  on public.production_boms (business_id, lower(code));
create index if not exists production_boms_business_status_idx
  on public.production_boms (business_id, status, updated_at desc);
create index if not exists production_bom_items_bom_idx
  on public.production_bom_items (business_id, bom_id);
create unique index if not exists production_bom_items_unique_material_key
  on public.production_bom_items (bom_id, material_product_id);

-- ---------------------------------------------------------------------------
-- Production orders and their snapshots/transactions
-- ---------------------------------------------------------------------------
create table if not exists public.production_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  code text not null,
  bom_id uuid references public.production_boms(id) on delete restrict,
  output_product_id uuid not null references public.products(id) on delete restrict,
  order_date date not null default current_date,
  planned_start_date date,
  planned_end_date date,
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'completed', 'cancelled')),
  planned_quantity numeric(15,3) not null check (planned_quantity > 0),
  actual_quantity numeric(15,3) not null default 0 check (actual_quantity >= 0),
  scrapped_quantity numeric(15,3) not null default 0 check (scrapped_quantity >= 0),
  planned_material_cost numeric(15,2) not null default 0 check (planned_material_cost >= 0),
  actual_material_cost numeric(15,2) not null default 0 check (actual_material_cost >= 0),
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.production_order_materials (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  bom_item_id uuid references public.production_bom_items(id) on delete set null,
  product_id uuid not null references public.products(id) on delete restrict,
  product_code text,
  product_name text not null,
  unit text,
  planned_quantity numeric(15,6) not null check (planned_quantity > 0),
  issued_quantity numeric(15,6) not null default 0 check (issued_quantity >= 0),
  returned_quantity numeric(15,6) not null default 0 check (returned_quantity >= 0),
  unit_cost numeric(15,4) not null default 0 check (unit_cost >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (returned_quantity <= issued_quantity)
);

create table if not exists public.production_order_outputs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity numeric(15,6) not null check (quantity > 0),
  unit_cost numeric(15,4) not null default 0 check (unit_cost >= 0),
  note text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.production_order_wastes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  waste_type text not null default 'scrap' check (waste_type in ('scrap', 'rework')),
  quantity numeric(15,6) not null check (quantity > 0),
  unit text,
  unit_cost numeric(15,4) not null default 0 check (unit_cost >= 0),
  reason text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.production_order_costs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  cost_type text not null check (cost_type in ('labor', 'machine', 'outsourcing', 'other')),
  description text not null,
  planned_amount numeric(15,2) not null default 0 check (planned_amount >= 0),
  actual_amount numeric(15,2) not null default 0 check (actual_amount >= 0),
  note text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists production_orders_business_code_key
  on public.production_orders (business_id, lower(code));
create index if not exists production_orders_business_status_idx
  on public.production_orders (business_id, status, order_date desc, created_at desc);
create index if not exists production_order_materials_order_idx
  on public.production_order_materials (business_id, production_order_id);
create index if not exists production_order_outputs_order_idx
  on public.production_order_outputs (business_id, production_order_id, created_at desc);
create index if not exists production_order_wastes_order_idx
  on public.production_order_wastes (business_id, production_order_id, created_at desc);
create index if not exists production_order_costs_order_idx
  on public.production_order_costs (business_id, production_order_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Read models used by the UI and basic management reports
-- ---------------------------------------------------------------------------
create or replace view public.v_production_bom_summary
with (security_invoker = true)
as
select
  b.id,
  b.business_id,
  b.code,
  b.name,
  b.output_product_id,
  p.code as output_product_code,
  p.name as output_product_name,
  p.unit as output_unit,
  b.output_quantity,
  b.version,
  b.status,
  b.note,
  count(i.id)::integer as item_count,
  coalesce(sum(i.quantity * (1 + i.scrap_rate / 100) * i.unit_cost), 0)::numeric(15,2) as planned_material_cost,
  b.created_at,
  b.updated_at
from public.production_boms b
join public.products p on p.id = b.output_product_id and p.business_id = b.business_id
left join public.production_bom_items i on i.bom_id = b.id and i.business_id = b.business_id
group by b.id, p.code, p.name, p.unit;

create or replace view public.v_production_order_summary
with (security_invoker = true)
as
with material_totals as (
  select
    m.business_id,
    m.production_order_id,
    coalesce(sum(m.planned_quantity * m.unit_cost), 0)::numeric(15,2) as planned_material_cost,
    coalesce(sum((m.issued_quantity - m.returned_quantity) * m.unit_cost), 0)::numeric(15,2) as actual_material_cost,
    count(*)::integer as material_count,
    coalesce(sum(m.planned_quantity), 0)::numeric(15,3) as planned_material_quantity,
    coalesce(sum(m.issued_quantity), 0)::numeric(15,3) as issued_material_quantity,
    coalesce(sum(m.returned_quantity), 0)::numeric(15,3) as returned_material_quantity
  from public.production_order_materials m
  group by m.business_id, m.production_order_id
), output_totals as (
  select
    o.business_id,
    o.production_order_id,
    coalesce(sum(o.quantity), 0)::numeric(15,3) as actual_quantity,
    coalesce(sum(o.quantity * o.unit_cost), 0)::numeric(15,2) as output_value,
    count(*)::integer as output_receipt_count
  from public.production_order_outputs o
  group by o.business_id, o.production_order_id
), waste_totals as (
  select
    w.business_id,
    w.production_order_id,
    coalesce(sum(w.quantity), 0)::numeric(15,3) as scrapped_quantity,
    coalesce(sum(w.quantity * w.unit_cost), 0)::numeric(15,2) as waste_value,
    count(*)::integer as waste_count
  from public.production_order_wastes w
  where w.waste_type = 'scrap'
  group by w.business_id, w.production_order_id
), cost_totals as (
  select
    c.business_id,
    c.production_order_id,
    coalesce(sum(c.planned_amount) filter (where c.cost_type = 'labor'), 0)::numeric(15,2) as planned_labor_cost,
    coalesce(sum(c.actual_amount) filter (where c.cost_type = 'labor'), 0)::numeric(15,2) as actual_labor_cost,
    coalesce(sum(c.planned_amount) filter (where c.cost_type = 'machine'), 0)::numeric(15,2) as planned_machine_cost,
    coalesce(sum(c.actual_amount) filter (where c.cost_type = 'machine'), 0)::numeric(15,2) as actual_machine_cost,
    coalesce(sum(c.planned_amount) filter (where c.cost_type = 'outsourcing'), 0)::numeric(15,2) as planned_outsourcing_cost,
    coalesce(sum(c.actual_amount) filter (where c.cost_type = 'outsourcing'), 0)::numeric(15,2) as actual_outsourcing_cost,
    coalesce(sum(c.planned_amount) filter (where c.cost_type = 'other'), 0)::numeric(15,2) as planned_other_cost,
    coalesce(sum(c.actual_amount) filter (where c.cost_type = 'other'), 0)::numeric(15,2) as actual_other_cost,
    count(*)::integer as cost_count
  from public.production_order_costs c
  group by c.business_id, c.production_order_id
)
select
  o.id,
  o.business_id,
  o.code,
  o.bom_id,
  b.code as bom_code,
  b.name as bom_name,
  o.output_product_id,
  p.code as output_product_code,
  p.name as output_product_name,
  p.unit as output_unit,
  o.order_date,
  o.planned_start_date,
  o.planned_end_date,
  o.status,
  o.planned_quantity,
  coalesce(ot.actual_quantity, 0)::numeric(15,3) as actual_quantity,
  coalesce(wt.scrapped_quantity, 0)::numeric(15,3) as scrapped_quantity,
  coalesce(mt.planned_material_cost, o.planned_material_cost, 0)::numeric(15,2) as planned_material_cost,
  coalesce(mt.actual_material_cost, 0)::numeric(15,2) as actual_material_cost,
  coalesce(ct.planned_labor_cost, 0)::numeric(15,2) as planned_labor_cost,
  coalesce(ct.actual_labor_cost, 0)::numeric(15,2) as actual_labor_cost,
  coalesce(ct.planned_machine_cost, 0)::numeric(15,2) as planned_machine_cost,
  coalesce(ct.actual_machine_cost, 0)::numeric(15,2) as actual_machine_cost,
  coalesce(ct.planned_outsourcing_cost, 0)::numeric(15,2) as planned_outsourcing_cost,
  coalesce(ct.actual_outsourcing_cost, 0)::numeric(15,2) as actual_outsourcing_cost,
  coalesce(ct.planned_other_cost, 0)::numeric(15,2) as planned_other_cost,
  coalesce(ct.actual_other_cost, 0)::numeric(15,2) as actual_other_cost,
  (
    coalesce(mt.planned_material_cost, o.planned_material_cost, 0)
    + coalesce(ct.planned_labor_cost, 0)
    + coalesce(ct.planned_machine_cost, 0)
    + coalesce(ct.planned_outsourcing_cost, 0)
    + coalesce(ct.planned_other_cost, 0)
  )::numeric(15,2) as planned_total_cost,
  (
    coalesce(mt.actual_material_cost, 0)
    + coalesce(ct.actual_labor_cost, 0)
    + coalesce(ct.actual_machine_cost, 0)
    + coalesce(ct.actual_outsourcing_cost, 0)
    + coalesce(ct.actual_other_cost, 0)
  )::numeric(15,2) as actual_total_cost,
  (
    coalesce(mt.actual_material_cost, 0)
    + coalesce(ct.actual_labor_cost, 0)
    + coalesce(ct.actual_machine_cost, 0)
    + coalesce(ct.actual_outsourcing_cost, 0)
    + coalesce(ct.actual_other_cost, 0)
    - coalesce(mt.planned_material_cost, o.planned_material_cost, 0)
    - coalesce(ct.planned_labor_cost, 0)
    - coalesce(ct.planned_machine_cost, 0)
    - coalesce(ct.planned_outsourcing_cost, 0)
    - coalesce(ct.planned_other_cost, 0)
  )::numeric(15,2) as cost_variance,
  case when coalesce(ot.actual_quantity, 0) > 0 then (
    coalesce(mt.actual_material_cost, 0)
    + coalesce(ct.actual_labor_cost, 0)
    + coalesce(ct.actual_machine_cost, 0)
    + coalesce(ct.actual_outsourcing_cost, 0)
    + coalesce(ct.actual_other_cost, 0)
  ) / ot.actual_quantity else 0 end::numeric(15,4) as actual_unit_cost,
  coalesce(mt.material_count, 0) as material_count,
  coalesce(mt.planned_material_quantity, 0)::numeric(15,3) as planned_material_quantity,
  coalesce(mt.issued_material_quantity, 0)::numeric(15,3) as issued_material_quantity,
  coalesce(mt.returned_material_quantity, 0)::numeric(15,3) as returned_material_quantity,
  coalesce(ot.output_receipt_count, 0) as output_receipt_count,
  coalesce(wt.waste_count, 0) as waste_count,
  coalesce(ct.cost_count, 0) as cost_count,
  o.note,
  o.created_by,
  o.created_at,
  o.updated_at
from public.production_orders o
join public.products p on p.id = o.output_product_id and p.business_id = o.business_id
left join public.production_boms b on b.id = o.bom_id and b.business_id = o.business_id
left join material_totals mt on mt.business_id = o.business_id and mt.production_order_id = o.id
left join output_totals ot on ot.business_id = o.business_id and ot.production_order_id = o.id
left join waste_totals wt on wt.business_id = o.business_id and wt.production_order_id = o.id
left join cost_totals ct on ct.business_id = o.business_id and ct.production_order_id = o.id;

grant select on public.v_production_bom_summary, public.v_production_order_summary to authenticated;

-- ---------------------------------------------------------------------------
-- RLS: members can read their business; all writes go through guarded RPCs.
-- ---------------------------------------------------------------------------
alter table public.production_boms enable row level security;
alter table public.production_bom_items enable row level security;
alter table public.production_orders enable row level security;
alter table public.production_order_materials enable row level security;
alter table public.production_order_outputs enable row level security;
alter table public.production_order_wastes enable row level security;
alter table public.production_order_costs enable row level security;

drop policy if exists smarterp_production_boms_select on public.production_boms;
create policy smarterp_production_boms_select on public.production_boms for select to authenticated
using (public.business_role(business_id) is not null);
drop policy if exists smarterp_production_bom_items_select on public.production_bom_items;
create policy smarterp_production_bom_items_select on public.production_bom_items for select to authenticated
using (public.business_role(business_id) is not null);
drop policy if exists smarterp_production_orders_select on public.production_orders;
create policy smarterp_production_orders_select on public.production_orders for select to authenticated
using (public.business_role(business_id) is not null);
drop policy if exists smarterp_production_order_materials_select on public.production_order_materials;
create policy smarterp_production_order_materials_select on public.production_order_materials for select to authenticated
using (public.business_role(business_id) is not null);
drop policy if exists smarterp_production_order_outputs_select on public.production_order_outputs;
create policy smarterp_production_order_outputs_select on public.production_order_outputs for select to authenticated
using (public.business_role(business_id) is not null);
drop policy if exists smarterp_production_order_wastes_select on public.production_order_wastes;
create policy smarterp_production_order_wastes_select on public.production_order_wastes for select to authenticated
using (public.business_role(business_id) is not null);
drop policy if exists smarterp_production_order_costs_select on public.production_order_costs;
create policy smarterp_production_order_costs_select on public.production_order_costs for select to authenticated
using (public.business_role(business_id) is not null);

grant select on public.production_boms, public.production_bom_items,
  public.production_orders, public.production_order_materials,
  public.production_order_outputs, public.production_order_wastes,
  public.production_order_costs to authenticated;
revoke all on public.production_boms, public.production_bom_items,
  public.production_orders, public.production_order_materials,
  public.production_order_outputs, public.production_order_wastes,
  public.production_order_costs from anon;

-- ---------------------------------------------------------------------------
-- Permission helper extension. Keep the existing role model and add only the
-- production capabilities needed by this module.
-- ---------------------------------------------------------------------------
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
    when 'production' then v_role in ('manager', 'warehouse', 'purchasing', 'accountant')
    when 'production_manage' then v_role in ('manager', 'warehouse', 'purchasing')
    when 'production_cost' then v_role in ('manager', 'accountant')
    else false
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guarded transactional functions
-- ---------------------------------------------------------------------------
create or replace function public.app_save_production_bom(
  p_business_id uuid,
  p_bom jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bom public.production_boms%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_bom_id uuid := nullif(p_bom->>'id', '')::uuid;
  v_output_product_id uuid := nullif(p_bom->>'output_product_id', '')::uuid;
  v_output_quantity numeric := coalesce(nullif(p_bom->>'output_quantity', '')::numeric, 1);
  v_version integer := greatest(1, coalesce(nullif(p_bom->>'version', '')::integer, 1));
  v_code text;
  v_name text := nullif(trim(coalesce(p_bom->>'name', '')), '');
  v_quantity numeric;
  v_scrap_rate numeric;
  v_material_id uuid;
  v_material public.products%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'production_manage');
  if v_name is null then raise exception 'Vui lòng nhập tên định mức.'; end if;
  if v_output_quantity <= 0 then raise exception 'Sản lượng định mức phải lớn hơn 0.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Định mức phải có ít nhất một nguyên vật liệu.';
  end if;
  if (select count(*) from jsonb_array_elements(p_items)) <> (
    select count(distinct nullif(value->>'product_id', '')) from jsonb_array_elements(p_items)
  ) then
    raise exception 'Mỗi nguyên vật liệu chỉ được xuất hiện một lần trong định mức.';
  end if;

  select * into v_product
  from public.products
  where id = v_output_product_id and business_id = p_business_id and active = true
  for update;
  if not found or lower(coalesce(v_product.product_type::text, '')) = 'service' then
    raise exception 'Sản phẩm đầu ra không hợp lệ hoặc là dịch vụ.';
  end if;

  if v_bom_id is null then
    v_code := upper(coalesce(nullif(trim(p_bom->>'code'), ''), public.take_document_code(p_business_id, 'production_bom', 'BOM-')));
    insert into public.production_boms (
      business_id, code, name, output_product_id, output_quantity, version, status, note, created_by
    ) values (
      p_business_id, v_code, v_name, v_output_product_id, v_output_quantity, v_version,
      coalesce(nullif(p_bom->>'status', ''), 'draft'), nullif(trim(p_bom->>'note'), ''), auth.uid()
    ) returning * into v_bom;
  else
    select * into v_bom from public.production_boms where id = v_bom_id and business_id = p_business_id for update;
    if not found then raise exception 'Không tìm thấy định mức.'; end if;
    if v_bom.status = 'archived' then raise exception 'Định mức đã lưu trữ không thể chỉnh sửa.'; end if;
    update public.production_boms
    set name = v_name,
        output_product_id = v_output_product_id,
        output_quantity = v_output_quantity,
        version = v_version,
        note = nullif(trim(p_bom->>'note'), ''),
        updated_at = now()
    where id = v_bom_id and business_id = p_business_id
    returning * into v_bom;
    delete from public.production_bom_items where bom_id = v_bom_id and business_id = p_business_id;
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_material_id := nullif(v_item->>'product_id', '')::uuid;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
    v_scrap_rate := coalesce(nullif(v_item->>'scrap_rate', '')::numeric, 0);
    if v_material_id is null or v_quantity <= 0 or v_scrap_rate < 0 or v_scrap_rate > 100 then
      raise exception 'Nguyên vật liệu hoặc tỷ lệ hao hụt không hợp lệ.';
    end if;
    select * into v_material
    from public.products
    where id = v_material_id and business_id = p_business_id and active = true
    for update;
    if not found or lower(coalesce(v_material.product_type::text, '')) = 'service' then
      raise exception 'Có nguyên vật liệu không tồn tại hoặc là dịch vụ.';
    end if;
    if v_material.id = v_output_product_id then
      raise exception 'Sản phẩm đầu ra không thể đồng thời là nguyên vật liệu.';
    end if;
    insert into public.production_bom_items (
      business_id, bom_id, material_product_id, quantity, scrap_rate, unit, unit_cost, note
    ) values (
      p_business_id, v_bom.id, v_material.id, v_quantity, v_scrap_rate, v_material.unit,
      coalesce(v_material.cost_price, 0), nullif(trim(v_item->>'note'), '')
    );
  end loop;

  return to_jsonb(v_bom);
end;
$$;

create or replace function public.app_set_production_bom_status(
  p_business_id uuid,
  p_bom_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bom public.production_boms%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'production_manage');
  if lower(coalesce(p_status, '')) not in ('draft', 'active', 'archived') then
    raise exception 'Trạng thái định mức không hợp lệ.';
  end if;
  select * into v_bom from public.production_boms where id = p_bom_id and business_id = p_business_id for update;
  if not found then raise exception 'Không tìm thấy định mức.'; end if;
  if lower(p_status) = 'active' and not exists (select 1 from public.production_bom_items where bom_id = p_bom_id) then
    raise exception 'Định mức phải có nguyên vật liệu trước khi kích hoạt.';
  end if;
  update public.production_boms set status = lower(p_status), updated_at = now()
  where id = p_bom_id and business_id = p_business_id returning * into v_bom;
  return to_jsonb(v_bom);
end;
$$;

create or replace function public.app_create_production_order(
  p_business_id uuid,
  p_order jsonb,
  p_materials jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.production_orders%rowtype;
  v_bom public.production_boms%rowtype;
  v_bom_item record;
  v_item jsonb;
  v_cost jsonb;
  v_order_bom_id uuid := nullif(p_order->>'bom_id', '')::uuid;
  v_output_product_id uuid := nullif(p_order->>'output_product_id', '')::uuid;
  v_order_quantity numeric := coalesce(nullif(p_order->>'planned_quantity', '')::numeric, 0);
  v_planned_quantity numeric;
  v_unit_cost numeric;
  v_planned_material_cost numeric := 0;
  v_material_id uuid;
  v_material public.products%rowtype;
  v_cost_type text;
  v_planned_amount numeric;
  v_actual_amount numeric;
begin
  perform public.assert_business_permission(p_business_id, 'production_manage');
  if v_order_quantity <= 0 then raise exception 'Sản lượng kế hoạch phải lớn hơn 0.'; end if;

  if v_order_bom_id is not null then
    select * into v_bom
    from public.production_boms
    where id = v_order_bom_id and business_id = p_business_id and status = 'active'
    for update;
    if not found then raise exception 'Định mức không tồn tại hoặc chưa được kích hoạt.'; end if;
    v_output_product_id := v_bom.output_product_id;
  end if;

  select * into v_material
  from public.products
  where id = v_output_product_id and business_id = p_business_id and active = true
  for update;
  if not found or lower(coalesce(v_material.product_type::text, '')) = 'service' then
    raise exception 'Sản phẩm thành phẩm không hợp lệ hoặc là dịch vụ.'; end if;

  insert into public.production_orders (
    business_id, code, bom_id, output_product_id, order_date,
    planned_start_date, planned_end_date, status, planned_quantity, note, created_by
  ) values (
    p_business_id,
    upper(coalesce(nullif(trim(p_order->>'code'), ''), public.take_document_code(p_business_id, 'production_order', 'LSX-'))),
    v_order_bom_id,
    v_output_product_id,
    coalesce(nullif(p_order->>'order_date', '')::date, current_date),
    nullif(p_order->>'planned_start_date', '')::date,
    nullif(p_order->>'planned_end_date', '')::date,
    'planned', v_order_quantity, nullif(trim(p_order->>'note'), ''), auth.uid()
  ) returning * into v_order;

  if v_bom.id is not null then
    for v_bom_item in
      select bi.*, p.code as product_code, p.name as product_name, p.unit as product_unit,
        coalesce(p.cost_price, bi.unit_cost, 0) as current_cost
      from public.production_bom_items bi
      join public.products p on p.id = bi.material_product_id and p.business_id = p_business_id and p.active = true
      where bi.bom_id = v_bom.id and bi.business_id = p_business_id
      order by bi.created_at asc
    loop
      v_planned_quantity := round(v_bom_item.quantity * v_order_quantity / v_bom.output_quantity * (1 + v_bom_item.scrap_rate / 100), 6);
      v_unit_cost := coalesce(v_bom_item.current_cost, 0);
      insert into public.production_order_materials (
        business_id, production_order_id, bom_item_id, product_id, product_code,
        product_name, unit, planned_quantity, unit_cost, note
      ) values (
        p_business_id, v_order.id, v_bom_item.id, v_bom_item.material_product_id,
        v_bom_item.product_code, v_bom_item.product_name, v_bom_item.product_unit,
        v_planned_quantity, v_unit_cost, nullif(v_bom_item.note, '')
      );
      v_planned_material_cost := v_planned_material_cost + v_planned_quantity * v_unit_cost;
    end loop;
  elsif p_materials is not null and jsonb_typeof(p_materials) = 'array' then
    for v_item in select value from jsonb_array_elements(p_materials)
    loop
      v_material_id := nullif(v_item->>'product_id', '')::uuid;
      v_planned_quantity := coalesce(nullif(v_item->>'planned_quantity', '')::numeric, nullif(v_item->>'quantity', '')::numeric, 0);
      if v_material_id is null or v_planned_quantity <= 0 then raise exception 'Nguyên vật liệu kế hoạch không hợp lệ.'; end if;
      select * into v_material from public.products where id = v_material_id and business_id = p_business_id and active = true for update;
      if not found or lower(coalesce(v_material.product_type::text, '')) = 'service' then
        raise exception 'Có nguyên vật liệu không tồn tại hoặc là dịch vụ.';
      end if;
      insert into public.production_order_materials (
        business_id, production_order_id, product_id, product_code, product_name,
        unit, planned_quantity, unit_cost, note
      ) values (
        p_business_id, v_order.id, v_material.id, v_material.code, v_material.name,
        v_material.unit, v_planned_quantity, coalesce(v_material.cost_price, 0), nullif(trim(v_item->>'note'), '')
      );
      v_planned_material_cost := v_planned_material_cost + v_planned_quantity * coalesce(v_material.cost_price, 0);
    end loop;
  end if;

  update public.production_orders set planned_material_cost = round(v_planned_material_cost, 2), updated_at = now()
  where id = v_order.id;

  if p_order ? 'costs' and jsonb_typeof(p_order->'costs') = 'array' then
    for v_cost in select value from jsonb_array_elements(p_order->'costs')
    loop
      v_cost_type := lower(trim(coalesce(v_cost->>'cost_type', '')));
      v_planned_amount := greatest(0, coalesce(nullif(v_cost->>'planned_amount', '')::numeric, 0));
      v_actual_amount := greatest(0, coalesce(nullif(v_cost->>'actual_amount', '')::numeric, 0));
      if v_cost_type not in ('labor', 'machine', 'outsourcing', 'other') then raise exception 'Loại chi phí sản xuất không hợp lệ.'; end if;
      if nullif(trim(v_cost->>'description'), '') is null then raise exception 'Vui lòng nhập nội dung chi phí sản xuất.'; end if;
      insert into public.production_order_costs (
        business_id, production_order_id, cost_type, description, planned_amount, actual_amount, note, created_by
      ) values (
        p_business_id, v_order.id, v_cost_type, trim(v_cost->>'description'), v_planned_amount, v_actual_amount,
        nullif(trim(v_cost->>'note'), ''), auth.uid()
      );
    end loop;
  end if;

  select * into v_order from public.production_orders where id = v_order.id;
  return to_jsonb(v_order);
end;
$$;

create or replace function public.app_update_production_order_status(
  p_business_id uuid,
  p_order_id uuid,
  p_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.production_orders%rowtype;
  v_actual_quantity numeric;
begin
  perform public.assert_business_permission(p_business_id, 'production_manage');
  select * into v_order from public.production_orders where id = p_order_id and business_id = p_business_id for update;
  if not found then raise exception 'Không tìm thấy lệnh sản xuất.'; end if;
  p_status := lower(trim(coalesce(p_status, '')));
  if p_status not in ('planned', 'in_progress', 'completed', 'cancelled') then raise exception 'Trạng thái lệnh sản xuất không hợp lệ.'; end if;
  if p_status = v_order.status then return to_jsonb(v_order); end if;

  if p_status = 'in_progress' and v_order.status <> 'planned' then raise exception 'Chỉ lệnh đang chờ mới có thể bắt đầu.'; end if;
  if p_status = 'completed' then
    if v_order.status not in ('planned', 'in_progress') then raise exception 'Lệnh sản xuất không thể hoàn tất ở trạng thái hiện tại.'; end if;
    select coalesce(sum(quantity), 0) into v_actual_quantity from public.production_order_outputs where production_order_id = p_order_id;
    if v_actual_quantity <= 0 then raise exception 'Cần nhập ít nhất một lượng thành phẩm trước khi hoàn tất.'; end if;
  end if;
  if p_status = 'cancelled' then
    if v_order.status not in ('planned', 'in_progress') then raise exception 'Lệnh sản xuất không thể hủy ở trạng thái hiện tại.'; end if;
    if exists (select 1 from public.production_order_materials where production_order_id = p_order_id and issued_quantity > 0)
      or exists (select 1 from public.production_order_outputs where production_order_id = p_order_id) then
      raise exception 'Lệnh đã phát sinh xuất nguyên liệu hoặc nhập thành phẩm, không thể hủy.';
    end if;
  end if;
  if p_status = 'planned' and v_order.status <> 'in_progress' then raise exception 'Không thể chuyển lệnh về trạng thái chờ.'; end if;

  update public.production_orders
  set status = p_status, note = coalesce(nullif(trim(p_note), ''), note), updated_at = now()
  where id = p_order_id and business_id = p_business_id
  returning * into v_order;
  return to_jsonb(v_order);
end;
$$;

create or replace function public.app_issue_production_materials(
  p_business_id uuid,
  p_order_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.production_orders%rowtype;
  v_material record;
  v_item jsonb;
  v_material_id uuid;
  v_quantity numeric;
  v_stock numeric;
begin
  perform public.assert_business_permission(p_business_id, 'production_manage');
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Chưa có nguyên liệu cần xuất.'; end if;
  select * into v_order from public.production_orders where id = p_order_id and business_id = p_business_id for update;
  if not found then raise exception 'Không tìm thấy lệnh sản xuất.'; end if;
  if v_order.status in ('completed', 'cancelled') then raise exception 'Lệnh sản xuất đã kết thúc.'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_material_id := nullif(v_item->>'material_id', '')::uuid;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
    if v_material_id is null or v_quantity <= 0 then raise exception 'Số lượng xuất nguyên liệu không hợp lệ.'; end if;
    select m.*, p.stock_on_hand, p.product_type into v_material
    from public.production_order_materials m
    join public.products p on p.id = m.product_id and p.business_id = p_business_id
    where m.id = v_material_id and m.business_id = p_business_id and m.production_order_id = p_order_id
    for update;
    if not found then raise exception 'Không tìm thấy dòng nguyên liệu của lệnh.'; end if;
    v_stock := coalesce(v_material.stock_on_hand, 0);
    if lower(coalesce(v_material.product_type::text, '')) = 'service' then raise exception 'Dịch vụ không thể xuất làm nguyên liệu.'; end if;
    if v_stock < v_quantity then raise exception 'Tồn kho % không đủ để xuất %.', v_material.product_name, v_quantity; end if;
    insert into public.stock_movements (
      business_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, note, created_by
    ) values (
      p_business_id, v_material.product_id, 'adjustment', -v_quantity, v_material.unit_cost,
      'production_issue', p_order_id, 'Xuất nguyên liệu cho lệnh ' || v_order.code, auth.uid()
    );
    update public.production_order_materials
    set issued_quantity = issued_quantity + v_quantity, updated_at = now()
    where id = v_material.id and business_id = p_business_id;
  end loop;

  update public.production_orders
  set status = case when status = 'planned' then 'in_progress' else status end,
      actual_material_cost = coalesce((select sum((issued_quantity - returned_quantity) * unit_cost) from public.production_order_materials where production_order_id = p_order_id), 0),
      updated_at = now()
  where id = p_order_id and business_id = p_business_id
  returning * into v_order;
  return to_jsonb(v_order);
end;
$$;

create or replace function public.app_return_production_materials(
  p_business_id uuid,
  p_order_id uuid,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.production_orders%rowtype;
  v_material record;
  v_item jsonb;
  v_material_id uuid;
  v_quantity numeric;
  v_remaining numeric;
begin
  perform public.assert_business_permission(p_business_id, 'production_manage');
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Chưa có nguyên liệu cần trả.'; end if;
  select * into v_order from public.production_orders where id = p_order_id and business_id = p_business_id for update;
  if not found then raise exception 'Không tìm thấy lệnh sản xuất.'; end if;
  if v_order.status in ('completed', 'cancelled') then raise exception 'Lệnh sản xuất đã kết thúc.'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_material_id := nullif(v_item->>'material_id', '')::uuid;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::numeric, 0);
    if v_material_id is null or v_quantity <= 0 then raise exception 'Số lượng trả nguyên liệu không hợp lệ.'; end if;
    select m.*, p.product_type into v_material
    from public.production_order_materials m
    join public.products p on p.id = m.product_id and p.business_id = p_business_id
    where m.id = v_material_id and m.business_id = p_business_id and m.production_order_id = p_order_id
    for update;
    if not found then raise exception 'Không tìm thấy dòng nguyên liệu của lệnh.'; end if;
    v_remaining := v_material.issued_quantity - v_material.returned_quantity;
    if v_quantity > v_remaining then raise exception 'Số lượng trả vượt quá nguyên liệu đã xuất.'; end if;
    insert into public.stock_movements (
      business_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, note, created_by
    ) values (
      p_business_id, v_material.product_id, 'adjustment', v_quantity, v_material.unit_cost,
      'production_return', p_order_id, 'Trả nguyên liệu thừa của lệnh ' || v_order.code, auth.uid()
    );
    update public.production_order_materials
    set returned_quantity = returned_quantity + v_quantity, updated_at = now()
    where id = v_material.id and business_id = p_business_id;
  end loop;

  update public.production_orders
  set actual_material_cost = coalesce((select sum((issued_quantity - returned_quantity) * unit_cost) from public.production_order_materials where production_order_id = p_order_id), 0),
      updated_at = now()
  where id = p_order_id and business_id = p_business_id
  returning * into v_order;
  return to_jsonb(v_order);
end;
$$;

create or replace function public.app_receive_production_output(
  p_business_id uuid,
  p_order_id uuid,
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
  v_order public.production_orders%rowtype;
  v_existing_quantity numeric;
  v_actual_total numeric;
  v_unit_cost numeric;
begin
  perform public.assert_business_permission(p_business_id, 'production_manage');
  if p_quantity is null or p_quantity <= 0 then raise exception 'Số lượng thành phẩm phải lớn hơn 0.'; end if;
  if p_unit_cost is not null and p_unit_cost < 0 then raise exception 'Giá thành đơn vị không hợp lệ.'; end if;
  select * into v_order from public.production_orders where id = p_order_id and business_id = p_business_id for update;
  if not found then raise exception 'Không tìm thấy lệnh sản xuất.'; end if;
  if v_order.status in ('completed', 'cancelled') then raise exception 'Lệnh sản xuất đã kết thúc.'; end if;

  select coalesce(sum(quantity), 0) into v_existing_quantity from public.production_order_outputs where production_order_id = p_order_id;
  select
    coalesce(sum((issued_quantity - returned_quantity) * unit_cost), 0)
    + coalesce((select sum(actual_amount) from public.production_order_costs where production_order_id = p_order_id), 0)
  into v_actual_total
  from public.production_order_materials
  where production_order_id = p_order_id;
  v_unit_cost := coalesce(p_unit_cost, case when v_existing_quantity + p_quantity > 0 then v_actual_total / (v_existing_quantity + p_quantity) else 0 end, 0);

  insert into public.stock_movements (
    business_id, product_id, movement_type, quantity, unit_cost, reference_type, reference_id, note, created_by
  ) values (
    p_business_id, v_order.output_product_id, 'adjustment', p_quantity, v_unit_cost,
    'production_receipt', p_order_id, 'Nhập thành phẩm theo lệnh ' || v_order.code, auth.uid()
  );
  insert into public.production_order_outputs (
    business_id, production_order_id, product_id, quantity, unit_cost, note, created_by
  ) values (
    p_business_id, p_order_id, v_order.output_product_id, p_quantity, v_unit_cost, nullif(trim(p_note), ''), auth.uid()
  );

  update public.production_orders
  set status = case when status = 'planned' then 'in_progress' else status end,
      actual_quantity = actual_quantity + p_quantity,
      actual_material_cost = coalesce((select sum((issued_quantity - returned_quantity) * unit_cost) from public.production_order_materials where production_order_id = p_order_id), 0),
      updated_at = now()
  where id = p_order_id and business_id = p_business_id
  returning * into v_order;
  return jsonb_build_object('order', to_jsonb(v_order), 'unit_cost', v_unit_cost, 'quantity', p_quantity);
end;
$$;

create or replace function public.app_record_production_waste(
  p_business_id uuid,
  p_order_id uuid,
  p_quantity numeric,
  p_waste_type text default 'scrap',
  p_product_id uuid default null,
  p_unit_cost numeric default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.production_orders%rowtype;
  v_product public.products%rowtype;
  v_product_id uuid;
  v_unit_cost numeric;
  v_row public.production_order_wastes%rowtype;
begin
  perform public.assert_business_permission(p_business_id, 'production_manage');
  if p_quantity is null or p_quantity <= 0 then raise exception 'Số lượng phế phẩm phải lớn hơn 0.'; end if;
  if lower(coalesce(p_waste_type, '')) not in ('scrap', 'rework') then raise exception 'Loại phế phẩm không hợp lệ.'; end if;
  select * into v_order from public.production_orders where id = p_order_id and business_id = p_business_id for update;
  if not found then raise exception 'Không tìm thấy lệnh sản xuất.'; end if;
  if v_order.status in ('completed', 'cancelled') then raise exception 'Lệnh sản xuất đã kết thúc.'; end if;
  v_product_id := coalesce(p_product_id, v_order.output_product_id);
  select * into v_product from public.products where id = v_product_id and business_id = p_business_id and active = true for update;
  if not found or lower(coalesce(v_product.product_type::text, '')) = 'service' then raise exception 'Sản phẩm phế phẩm không hợp lệ.'; end if;
  v_unit_cost := coalesce(p_unit_cost, v_product.cost_price, 0);
  if v_unit_cost < 0 then raise exception 'Giá vốn phế phẩm không hợp lệ.'; end if;

  insert into public.production_order_wastes (
    business_id, production_order_id, product_id, waste_type, quantity, unit, unit_cost, reason, created_by
  ) values (
    p_business_id, p_order_id, v_product_id, lower(p_waste_type), p_quantity, v_product.unit, v_unit_cost,
    nullif(trim(p_reason), ''), auth.uid()
  ) returning * into v_row;
  update public.production_orders
  set scrapped_quantity = scrapped_quantity + case when lower(p_waste_type) = 'scrap' then p_quantity else 0 end,
      updated_at = now()
  where id = p_order_id and business_id = p_business_id;
  return to_jsonb(v_row);
end;
$$;

create or replace function public.app_add_production_cost(
  p_business_id uuid,
  p_order_id uuid,
  p_cost jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.production_orders%rowtype;
  v_cost public.production_order_costs%rowtype;
  v_cost_type text := lower(trim(coalesce(p_cost->>'cost_type', '')));
  v_description text := nullif(trim(coalesce(p_cost->>'description', '')), '');
  v_planned_amount numeric := greatest(0, coalesce(nullif(p_cost->>'planned_amount', '')::numeric, 0));
  v_actual_amount numeric := greatest(0, coalesce(nullif(p_cost->>'actual_amount', '')::numeric, 0));
begin
  perform public.assert_business_permission(p_business_id, 'production_cost');
  select * into v_order from public.production_orders where id = p_order_id and business_id = p_business_id;
  if not found then raise exception 'Không tìm thấy lệnh sản xuất.'; end if;
  if v_order.status = 'cancelled' then raise exception 'Lệnh sản xuất đã hủy.'; end if;
  if v_cost_type not in ('labor', 'machine', 'outsourcing', 'other') then raise exception 'Loại chi phí sản xuất không hợp lệ.'; end if;
  if v_description is null then raise exception 'Vui lòng nhập nội dung chi phí sản xuất.'; end if;
  insert into public.production_order_costs (
    business_id, production_order_id, cost_type, description, planned_amount, actual_amount, note, created_by
  ) values (
    p_business_id, p_order_id, v_cost_type, v_description, v_planned_amount, v_actual_amount,
    nullif(trim(p_cost->>'note'), ''), auth.uid()
  ) returning * into v_cost;
  return to_jsonb(v_cost);
end;
$$;

-- Keep the surface area explicit: clients can read rows and call only the
-- guarded workflows above.
revoke execute on function public.app_save_production_bom(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.app_set_production_bom_status(uuid, uuid, text) from public, anon;
revoke execute on function public.app_create_production_order(uuid, jsonb, jsonb) from public, anon;
revoke execute on function public.app_update_production_order_status(uuid, uuid, text, text) from public, anon;
revoke execute on function public.app_issue_production_materials(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.app_return_production_materials(uuid, uuid, jsonb) from public, anon;
revoke execute on function public.app_receive_production_output(uuid, uuid, numeric, numeric, text) from public, anon;
revoke execute on function public.app_record_production_waste(uuid, uuid, numeric, text, uuid, numeric, text) from public, anon;
revoke execute on function public.app_add_production_cost(uuid, uuid, jsonb) from public, anon;

grant execute on function public.app_save_production_bom(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.app_set_production_bom_status(uuid, uuid, text) to authenticated;
grant execute on function public.app_create_production_order(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.app_update_production_order_status(uuid, uuid, text, text) to authenticated;
grant execute on function public.app_issue_production_materials(uuid, uuid, jsonb) to authenticated;
grant execute on function public.app_return_production_materials(uuid, uuid, jsonb) to authenticated;
grant execute on function public.app_receive_production_output(uuid, uuid, numeric, numeric, text) to authenticated;
grant execute on function public.app_record_production_waste(uuid, uuid, numeric, text, uuid, numeric, text) to authenticated;
grant execute on function public.app_add_production_cost(uuid, uuid, jsonb) to authenticated;

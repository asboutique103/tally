-- ConstructFlow Ledger - initial Supabase schema
-- Run this entire file once in Supabase SQL Editor.

create extension if not exists pgcrypto;

create type public.app_role as enum ('owner', 'admin', 'accountant', 'storekeeper', 'site_engineer', 'viewer');
create type public.supplier_status as enum ('active', 'inactive');
create type public.site_status as enum ('planning', 'active', 'on_hold', 'completed');
create type public.receipt_destination as enum ('central_store', 'direct_to_site');
create type public.bill_type as enum ('purchase', 'client');
create type public.payment_status as enum ('unpaid', 'partially_paid', 'paid', 'overdue');
create type public.payment_direction as enum ('paid', 'received');
create type public.payment_mode as enum ('cash', 'bank_transfer', 'cheque', 'upi', 'card');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gstin text,
  phone text,
  email text,
  address text,
  currency text not null default 'INR',
  default_tax_rate numeric(7,2) not null default 18 check (default_tax_rate >= 0),
  low_stock_alerts boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  contact_person text,
  phone text,
  email text,
  gstin text,
  address text,
  opening_balance numeric(14,2) not null default 0,
  status public.supplier_status not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  client_name text,
  location text,
  site_engineer text,
  phone text,
  budget numeric(16,2) not null default 0 check (budget >= 0),
  start_date date,
  expected_end_date date,
  status public.site_status not null default 'planning',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  category text,
  unit text not null,
  standard_rate numeric(14,4) not null default 0 check (standard_rate >= 0),
  tax_rate numeric(7,2) not null default 0 check (tax_rate >= 0),
  reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  opening_stock numeric(14,3) not null default 0,
  storage_location text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.material_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  receipt_no text not null,
  receipt_date date not null default current_date,
  supplier_id uuid not null references public.suppliers(id),
  supplier_invoice_no text,
  vehicle_no text,
  received_by text,
  destination public.receipt_destination not null default 'central_store',
  site_id uuid references public.sites(id),
  notes text,
  attachment_path text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, receipt_no),
  check ((destination = 'direct_to_site' and site_id is not null) or destination = 'central_store')
);

create table public.material_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.material_receipts(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  quantity numeric(14,3) not null check (quantity > 0),
  rate numeric(14,4) not null default 0 check (rate >= 0),
  tax_rate numeric(7,2) not null default 0 check (tax_rate >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table public.material_supplies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  issue_no text not null,
  issue_date date not null default current_date,
  site_id uuid not null references public.sites(id),
  requested_by text,
  approved_by text,
  vehicle_no text,
  driver_name text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, issue_no)
);

create table public.material_supply_items (
  id uuid primary key default gen_random_uuid(),
  supply_id uuid not null references public.material_supplies(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  quantity numeric(14,3) not null check (quantity > 0),
  rate numeric(14,4) not null default 0 check (rate >= 0),
  tax_rate numeric(7,2) not null default 0 check (tax_rate >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bill_no text not null,
  bill_type public.bill_type not null,
  bill_date date not null default current_date,
  due_date date,
  supplier_id uuid references public.suppliers(id),
  site_id uuid references public.sites(id),
  party_name text not null,
  reference_no text,
  discount numeric(14,2) not null default 0 check (discount >= 0),
  other_charges numeric(14,2) not null default 0 check (other_charges >= 0),
  notes text,
  status public.payment_status not null default 'unpaid',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, bill_no),
  check ((bill_type = 'purchase' and supplier_id is not null) or (bill_type = 'client' and site_id is not null))
);

create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  material_id uuid references public.materials(id),
  description text,
  quantity numeric(14,3) not null check (quantity > 0),
  rate numeric(14,4) not null default 0 check (rate >= 0),
  tax_rate numeric(7,2) not null default 0 check (tax_rate >= 0),
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  payment_no text not null,
  payment_date date not null default current_date,
  bill_id uuid not null references public.bills(id) on delete restrict,
  party_name text not null,
  direction public.payment_direction not null,
  amount numeric(14,2) not null check (amount > 0),
  mode public.payment_mode not null,
  reference text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, payment_no)
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  performed_by uuid references auth.users(id),
  performed_at timestamptz not null default now()
);

create table if not exists public.app_state (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workspace_key text not null default 'default',
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, workspace_key)
);

create index suppliers_org_name_idx on public.suppliers (organization_id, name);
create index sites_org_status_idx on public.sites (organization_id, status);
create index materials_org_category_idx on public.materials (organization_id, category);
create index receipts_org_date_idx on public.material_receipts (organization_id, receipt_date desc);
create index receipt_items_material_idx on public.material_receipt_items (material_id);
create index supplies_org_date_idx on public.material_supplies (organization_id, issue_date desc);
create index supply_items_material_idx on public.material_supply_items (material_id);
create index bills_org_due_idx on public.bills (organization_id, due_date, status);
create index payments_org_date_idx on public.payments (organization_id, payment_date desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger suppliers_set_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger sites_set_updated_at before update on public.sites for each row execute function public.set_updated_at();
create trigger materials_set_updated_at before update on public.materials for each row execute function public.set_updated_at();
create trigger receipts_set_updated_at before update on public.material_receipts for each row execute function public.set_updated_at();
create trigger supplies_set_updated_at before update on public.material_supplies for each row execute function public.set_updated_at();
create trigger bills_set_updated_at before update on public.bills for each row execute function public.set_updated_at();
create trigger payments_set_updated_at before update on public.payments for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid() and is_active = true
  );
$$;

create or replace function public.has_org_role(org_id uuid, allowed_roles public.app_role[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id and user_id = auth.uid() and is_active = true and role = any(allowed_roles)
  );
$$;

create or replace function public.create_my_organization(org_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare new_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.organizations (name, created_by) values (org_name, auth.uid()) returning id into new_org_id;
  insert into public.organization_members (organization_id, user_id, role) values (new_org_id, auth.uid(), 'owner');
  return new_org_id;
end;
$$;

grant execute on function public.create_my_organization(text) to authenticated;

create or replace function public.refresh_bill_status(target_bill_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare total_amount numeric; paid_amount numeric; current_due date;
begin
  select coalesce(sum(i.quantity * i.rate * (1 + i.tax_rate / 100)), 0) + b.other_charges - b.discount, b.due_date
  into total_amount, current_due
  from public.bills b left join public.bill_items i on i.bill_id = b.id
  where b.id = target_bill_id
  group by b.id;

  select coalesce(sum(amount), 0) into paid_amount from public.payments where bill_id = target_bill_id;

  update public.bills set status = case
    when paid_amount >= total_amount and total_amount > 0 then 'paid'::public.payment_status
    when paid_amount > 0 then 'partially_paid'::public.payment_status
    when current_due is not null and current_due < current_date then 'overdue'::public.payment_status
    else 'unpaid'::public.payment_status
  end where id = target_bill_id;
end;
$$;

create or replace function public.payment_refresh_bill_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then perform public.refresh_bill_status(old.bill_id); return old; end if;
  perform public.refresh_bill_status(new.bill_id);
  if tg_op = 'UPDATE' and old.bill_id <> new.bill_id then perform public.refresh_bill_status(old.bill_id); end if;
  return new;
end;
$$;

create trigger payments_refresh_bill
after insert or update or delete on public.payments
for each row execute function public.payment_refresh_bill_trigger();

create or replace function public.prevent_negative_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare available numeric; org_id uuid;
begin
  select organization_id into org_id from public.material_supplies where id = new.supply_id;
  select m.opening_stock
      + coalesce((select sum(ri.quantity) from public.material_receipt_items ri join public.material_receipts r on r.id = ri.receipt_id where ri.material_id = new.material_id and r.organization_id = org_id and r.destination = 'central_store'), 0)
      - coalesce((select sum(si.quantity) from public.material_supply_items si join public.material_supplies s on s.id = si.supply_id where si.material_id = new.material_id and s.organization_id = org_id and si.id <> coalesce(new.id, gen_random_uuid())), 0)
  into available
  from public.materials m where m.id = new.material_id;
  if new.quantity > available then raise exception 'Insufficient stock. Available quantity: %', available; end if;
  return new;
end;
$$;

create trigger supply_item_stock_guard
before insert or update on public.material_supply_items
for each row execute function public.prevent_negative_stock();

create or replace function public.audit_row_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare org uuid; rid uuid;
begin
  org := coalesce((to_jsonb(new)->>'organization_id')::uuid, (to_jsonb(old)->>'organization_id')::uuid);
  rid := coalesce((to_jsonb(new)->>'id')::uuid, (to_jsonb(old)->>'id')::uuid);
  insert into public.audit_logs (organization_id, table_name, record_id, action, old_data, new_data, performed_by)
  values (org, tg_table_name, rid, tg_op, case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end, case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end, auth.uid());
  return coalesce(new, old);
end;
$$;

create trigger suppliers_audit after insert or update or delete on public.suppliers for each row execute function public.audit_row_changes();
create trigger sites_audit after insert or update or delete on public.sites for each row execute function public.audit_row_changes();
create trigger materials_audit after insert or update or delete on public.materials for each row execute function public.audit_row_changes();
create trigger receipts_audit after insert or update or delete on public.material_receipts for each row execute function public.audit_row_changes();
create trigger supplies_audit after insert or update or delete on public.material_supplies for each row execute function public.audit_row_changes();
create trigger bills_audit after insert or update or delete on public.bills for each row execute function public.audit_row_changes();
create trigger payments_audit after insert or update or delete on public.payments for each row execute function public.audit_row_changes();

create or replace view public.inventory_summary with (security_invoker = true) as
select
  m.id,
  m.organization_id,
  m.code,
  m.name,
  m.category,
  m.unit,
  m.standard_rate,
  m.reorder_level,
  m.opening_stock,
  coalesce(r.received_qty, 0) as received_qty,
  coalesce(s.supplied_qty, 0) as supplied_qty,
  m.opening_stock + coalesce(r.received_qty, 0) - coalesce(s.supplied_qty, 0) as available_qty,
  (m.opening_stock + coalesce(r.received_qty, 0) - coalesce(s.supplied_qty, 0)) * m.standard_rate as stock_value
from public.materials m
left join (
  select ri.material_id, sum(ri.quantity) received_qty
  from public.material_receipt_items ri
  join public.material_receipts mr on mr.id = ri.receipt_id
  where mr.destination = 'central_store'
  group by ri.material_id
) r on r.material_id = m.id
left join (
  select material_id, sum(quantity) supplied_qty
  from public.material_supply_items
  group by material_id
) s on s.material_id = m.id;

create or replace view public.bill_balances with (security_invoker = true) as
select
  b.id,
  b.organization_id,
  b.bill_no,
  b.bill_type,
  b.party_name,
  b.bill_date,
  b.due_date,
  b.status,
  coalesce(i.subtotal, 0) + coalesce(i.tax_amount, 0) + b.other_charges - b.discount as total_amount,
  coalesce(p.paid_amount, 0) as paid_amount,
  greatest(0, coalesce(i.subtotal, 0) + coalesce(i.tax_amount, 0) + b.other_charges - b.discount - coalesce(p.paid_amount, 0)) as balance_amount
from public.bills b
left join (
  select bill_id, sum(quantity * rate) subtotal, sum(quantity * rate * tax_rate / 100) tax_amount
  from public.bill_items group by bill_id
) i on i.bill_id = b.id
left join (
  select bill_id, sum(amount) paid_amount from public.payments group by bill_id
) p on p.bill_id = b.id;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.suppliers enable row level security;
alter table public.sites enable row level security;
alter table public.materials enable row level security;
alter table public.material_receipts enable row level security;
alter table public.material_receipt_items enable row level security;
alter table public.material_supplies enable row level security;
alter table public.material_supply_items enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;
alter table public.payments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.app_state enable row level security;

create policy profiles_self_select on public.profiles for select using (id = auth.uid());
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy organizations_member_select on public.organizations for select using (public.is_org_member(id));
create policy organizations_admin_update on public.organizations for update using (public.has_org_role(id, array['owner','admin']::public.app_role[])) with check (public.has_org_role(id, array['owner','admin']::public.app_role[]));

create policy members_org_select on public.organization_members for select using (public.is_org_member(organization_id));
create policy members_owner_manage on public.organization_members for all using (public.has_org_role(organization_id, array['owner']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner']::public.app_role[]));

create policy suppliers_member_select on public.suppliers for select using (public.is_org_member(organization_id));
create policy suppliers_accounts_write on public.suppliers for all using (public.has_org_role(organization_id, array['owner','admin','accountant']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','accountant']::public.app_role[]));

create policy sites_member_select on public.sites for select using (public.is_org_member(organization_id));
create policy sites_admin_write on public.sites for all using (public.has_org_role(organization_id, array['owner','admin']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin']::public.app_role[]));

create policy materials_member_select on public.materials for select using (public.is_org_member(organization_id));
create policy materials_store_write on public.materials for all using (public.has_org_role(organization_id, array['owner','admin','storekeeper']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','storekeeper']::public.app_role[]));

create policy receipts_member_select on public.material_receipts for select using (public.is_org_member(organization_id));
create policy receipts_store_write on public.material_receipts for all using (public.has_org_role(organization_id, array['owner','admin','storekeeper']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','storekeeper']::public.app_role[]));
create policy receipt_items_member_select on public.material_receipt_items for select using (exists (select 1 from public.material_receipts r where r.id = receipt_id and public.is_org_member(r.organization_id)));
create policy receipt_items_store_write on public.material_receipt_items for all using (exists (select 1 from public.material_receipts r where r.id = receipt_id and public.has_org_role(r.organization_id, array['owner','admin','storekeeper']::public.app_role[]))) with check (exists (select 1 from public.material_receipts r where r.id = receipt_id and public.has_org_role(r.organization_id, array['owner','admin','storekeeper']::public.app_role[])));

create policy supplies_member_select on public.material_supplies for select using (public.is_org_member(organization_id));
create policy supplies_store_write on public.material_supplies for all using (public.has_org_role(organization_id, array['owner','admin','storekeeper','site_engineer']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','storekeeper','site_engineer']::public.app_role[]));
create policy supply_items_member_select on public.material_supply_items for select using (exists (select 1 from public.material_supplies s where s.id = supply_id and public.is_org_member(s.organization_id)));
create policy supply_items_store_write on public.material_supply_items for all using (exists (select 1 from public.material_supplies s where s.id = supply_id and public.has_org_role(s.organization_id, array['owner','admin','storekeeper','site_engineer']::public.app_role[]))) with check (exists (select 1 from public.material_supplies s where s.id = supply_id and public.has_org_role(s.organization_id, array['owner','admin','storekeeper','site_engineer']::public.app_role[])));

create policy bills_member_select on public.bills for select using (public.is_org_member(organization_id));
create policy bills_accounts_write on public.bills for all using (public.has_org_role(organization_id, array['owner','admin','accountant']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','accountant']::public.app_role[]));
create policy bill_items_member_select on public.bill_items for select using (exists (select 1 from public.bills b where b.id = bill_id and public.is_org_member(b.organization_id)));
create policy bill_items_accounts_write on public.bill_items for all using (exists (select 1 from public.bills b where b.id = bill_id and public.has_org_role(b.organization_id, array['owner','admin','accountant']::public.app_role[]))) with check (exists (select 1 from public.bills b where b.id = bill_id and public.has_org_role(b.organization_id, array['owner','admin','accountant']::public.app_role[])));

create policy payments_member_select on public.payments for select using (public.is_org_member(organization_id));
create policy payments_accounts_write on public.payments for all using (public.has_org_role(organization_id, array['owner','admin','accountant']::public.app_role[])) with check (public.has_org_role(organization_id, array['owner','admin','accountant']::public.app_role[]));

create policy audit_admin_select on public.audit_logs for select using (organization_id is not null and public.has_org_role(organization_id, array['owner','admin']::public.app_role[]));

create policy app_state_owner_select on public.app_state for select to authenticated using ((select auth.uid()) = owner_id);
create policy app_state_owner_insert on public.app_state for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy app_state_owner_update on public.app_state for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy app_state_owner_delete on public.app_state for delete to authenticated using ((select auth.uid()) = owner_id);

grant select, insert, update, delete on public.app_state to authenticated;

-- Optional private bucket for receipt, bill and payment attachments.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('construction-documents', 'construction-documents', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy construction_docs_read on storage.objects for select to authenticated
using (bucket_id = 'construction-documents' and public.is_org_member((storage.foldername(name))[1]::uuid));
create policy construction_docs_insert on storage.objects for insert to authenticated
with check (bucket_id = 'construction-documents' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','accountant','storekeeper']::public.app_role[]));
create policy construction_docs_update on storage.objects for update to authenticated
using (bucket_id = 'construction-documents' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin','accountant','storekeeper']::public.app_role[]));
create policy construction_docs_delete on storage.objects for delete to authenticated
using (bucket_id = 'construction-documents' and public.has_org_role((storage.foldername(name))[1]::uuid, array['owner','admin']::public.app_role[]));
-- ConstructFlow Enterprise Accounting & Integrated Inventory upgrade
-- Run after 20260703_000001_constructflow_schema.sql.

create extension if not exists pgcrypto;

do $$ begin
  create type public.inventory_posting as enum ('auto_post', 'accounting_only');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.account_category as enum ('asset', 'liability', 'equity', 'income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.voucher_type as enum ('journal', 'contra', 'receipt', 'payment', 'debit_note', 'credit_note', 'opening');
exception when duplicate_object then null; end $$;

alter table public.organizations
  add column if not exists financial_year_start date,
  add column if not exists invoice_prefix text default 'CF',
  add column if not exists strict_stock_control boolean not null default true;

alter table public.bills
  add column if not exists inventory_posting public.inventory_posting not null default 'accounting_only';

create table if not exists public.ledger_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  category public.account_category not null,
  account_group text not null,
  opening_balance numeric(16,2) not null default 0,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, name)
);

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  voucher_no text not null,
  voucher_type public.voucher_type not null,
  voucher_date date not null default current_date,
  party_name text,
  reference text,
  narration text,
  source_type text not null default 'manual' check (source_type in ('manual','bill','payment','supply','opening')),
  source_id uuid,
  is_locked boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, voucher_no),
  unique (organization_id, source_type, source_id)
);

create table if not exists public.voucher_lines (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.vouchers(id) on delete cascade,
  account_id uuid not null references public.ledger_accounts(id),
  debit numeric(16,2) not null default 0 check (debit >= 0),
  credit numeric(16,2) not null default 0 check (credit >= 0),
  narration text,
  created_at timestamptz not null default now(),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create index if not exists ledger_accounts_org_category_idx on public.ledger_accounts (organization_id, category);
create index if not exists vouchers_org_date_idx on public.vouchers (organization_id, voucher_date desc);
create index if not exists voucher_lines_voucher_idx on public.voucher_lines (voucher_id);
create index if not exists voucher_lines_account_idx on public.voucher_lines (account_id);

create trigger ledger_accounts_set_updated_at before update on public.ledger_accounts for each row execute function public.set_updated_at();
create trigger vouchers_set_updated_at before update on public.vouchers for each row execute function public.set_updated_at();

create or replace function public.seed_default_accounts(org_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.ledger_accounts (organization_id, code, name, category, account_group, is_system)
  values
    (org_id,'1000','Cash in Hand','asset','Cash & Bank',true),
    (org_id,'1010','Primary Bank Account','asset','Cash & Bank',true),
    (org_id,'1100','Accounts Receivable','asset','Current Assets',true),
    (org_id,'1200','Inventory Asset','asset','Current Assets',true),
    (org_id,'1300','Input GST Credit','asset','Duties & Taxes',true),
    (org_id,'2000','Accounts Payable','liability','Current Liabilities',true),
    (org_id,'2100','Output GST Payable','liability','Duties & Taxes',true),
    (org_id,'3000','Opening Balance Equity','equity','Capital Account',true),
    (org_id,'4000','Construction Revenue','income','Direct Income',true),
    (org_id,'4100','Other Income','income','Indirect Income',true),
    (org_id,'4200','Discount Received','income','Indirect Income',true),
    (org_id,'5000','Material Purchases','expense','Direct Expenses',true),
    (org_id,'5100','Site Material Consumption','expense','Direct Expenses',true),
    (org_id,'5200','Freight & Other Charges','expense','Direct Expenses',true),
    (org_id,'5300','Discount Allowed','expense','Indirect Expenses',true)
  on conflict (organization_id, code) do nothing;
end;
$$;

select public.seed_default_accounts(id) from public.organizations;

create or replace function public.create_my_organization(org_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.organizations (name, created_by, financial_year_start)
  values (org_name, auth.uid(), make_date(extract(year from current_date)::int - case when extract(month from current_date) < 4 then 1 else 0 end, 4, 1))
  returning id into new_org_id;
  insert into public.organization_members (organization_id, user_id, role) values (new_org_id, auth.uid(), 'owner');
  perform public.seed_default_accounts(new_org_id);
  return new_org_id;
end;
$$;

grant execute on function public.create_my_organization(text) to authenticated;

create or replace function public.system_account_id(org_id uuid, account_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.ledger_accounts where organization_id = org_id and code = account_code limit 1;
$$;

create or replace function public.check_voucher_balance()
returns trigger language plpgsql set search_path = public as $$
declare target_id uuid; debit_total numeric; credit_total numeric;
begin
  target_id := coalesce(new.voucher_id, old.voucher_id);
  if not exists (select 1 from public.vouchers where id = target_id) then return coalesce(new, old); end if;
  select coalesce(sum(debit),0), coalesce(sum(credit),0) into debit_total, credit_total from public.voucher_lines where voucher_id = target_id;
  if abs(debit_total - credit_total) > 0.01 then
    raise exception 'Voucher is not balanced. Debit %, Credit %', debit_total, credit_total;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists voucher_lines_balance_guard on public.voucher_lines;
create constraint trigger voucher_lines_balance_guard
after insert or update or delete on public.voucher_lines
deferrable initially deferred for each row execute function public.check_voucher_balance();

create or replace function public.rebuild_bill_voucher(target_bill_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  b public.bills%rowtype; v_id uuid; subtotal numeric; tax_amount numeric; total_amount numeric; stock_cost numeric;
begin
  delete from public.vouchers where source_type = 'bill' and source_id = target_bill_id;
  select * into b from public.bills where id = target_bill_id;
  if not found then return; end if;
  select coalesce(sum(quantity*rate),0), coalesce(sum(quantity*rate*tax_rate/100),0),
         coalesce(sum(quantity*coalesce(m.standard_rate,bi.rate)),0)
    into subtotal, tax_amount, stock_cost
  from public.bill_items bi left join public.materials m on m.id=bi.material_id where bi.bill_id=target_bill_id;
  if subtotal = 0 and tax_amount = 0 and b.other_charges = 0 then return; end if;
  total_amount := subtotal + tax_amount + b.other_charges - b.discount;
  insert into public.vouchers (organization_id,voucher_no,voucher_type,voucher_date,party_name,reference,narration,source_type,source_id,is_locked,created_by)
  values (b.organization_id,b.bill_no,case when b.bill_type='purchase' then 'debit_note'::public.voucher_type else 'credit_note'::public.voucher_type end,b.bill_date,b.party_name,b.reference_no,b.notes,'bill',b.id,true,b.created_by)
  returning id into v_id;
  if b.bill_type='purchase' then
    insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration)
    values (v_id,public.system_account_id(b.organization_id,case when b.inventory_posting='auto_post' then '1200' else '5000' end),subtotal,0,'Purchase value');
    if tax_amount>0 then insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(b.organization_id,'1300'),tax_amount,0,'Input GST'); end if;
    if b.other_charges>0 then insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(b.organization_id,'5200'),b.other_charges,0,'Freight and charges'); end if;
    insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(b.organization_id,'2000'),0,total_amount,b.party_name);
    if b.discount>0 then insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(b.organization_id,'4200'),0,b.discount,'Discount received'); end if;
  else
    insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(b.organization_id,'1100'),total_amount,0,b.party_name);
    if b.discount>0 then insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(b.organization_id,'5300'),b.discount,0,'Discount allowed'); end if;
    insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(b.organization_id,'4000'),0,subtotal,'Construction revenue');
    if tax_amount>0 then insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(b.organization_id,'2100'),0,tax_amount,'Output GST'); end if;
    if b.other_charges>0 then insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(b.organization_id,'4100'),0,b.other_charges,'Other billed charges'); end if;
    if b.inventory_posting='auto_post' and stock_cost>0 then
      insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(b.organization_id,'5100'),stock_cost,0,'Cost of materials sold');
      insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(b.organization_id,'1200'),0,stock_cost,'Inventory issued through invoice');
    end if;
  end if;
end;
$$;

create or replace function public.bill_voucher_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.rebuild_bill_voucher(coalesce(new.bill_id,old.bill_id));
  if tg_op='UPDATE' and old.bill_id<>new.bill_id then perform public.rebuild_bill_voucher(old.bill_id); end if;
  return coalesce(new,old);
end;
$$;

drop trigger if exists bill_items_rebuild_voucher on public.bill_items;
create trigger bill_items_rebuild_voucher after insert or update or delete on public.bill_items for each row execute function public.bill_voucher_trigger();

create or replace function public.bill_header_voucher_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.rebuild_bill_voucher(coalesce(new.id,old.id)); return coalesce(new,old); end;
$$;

drop trigger if exists bills_rebuild_voucher on public.bills;
create trigger bills_rebuild_voucher after update of bill_no,bill_type,bill_date,party_name,reference_no,discount,other_charges,notes,inventory_posting on public.bills for each row execute function public.bill_header_voucher_trigger();

create or replace function public.rebuild_payment_voucher(target_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.payments%rowtype; v_id uuid; cash_code text;
begin
  delete from public.vouchers where source_type='payment' and source_id=target_payment_id;
  select * into p from public.payments where id=target_payment_id;
  if not found then return; end if;
  cash_code := case when p.mode='cash' then '1000' else '1010' end;
  insert into public.vouchers(organization_id,voucher_no,voucher_type,voucher_date,party_name,reference,narration,source_type,source_id,is_locked,created_by)
  values(p.organization_id,p.payment_no,case when p.direction='paid' then 'payment'::public.voucher_type else 'receipt'::public.voucher_type end,p.payment_date,p.party_name,p.reference,p.notes,'payment',p.id,true,p.created_by) returning id into v_id;
  if p.direction='paid' then
    insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(p.organization_id,'2000'),p.amount,0,p.party_name);
    insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(p.organization_id,cash_code),0,p.amount,p.mode::text);
  else
    insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(p.organization_id,cash_code),p.amount,0,p.mode::text);
    insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(p.organization_id,'1100'),0,p.amount,p.party_name);
  end if;
end;
$$;

create or replace function public.payment_voucher_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.rebuild_payment_voucher(coalesce(new.id,old.id));
  return coalesce(new,old);
end;
$$;

drop trigger if exists payments_rebuild_voucher on public.payments;
create trigger payments_rebuild_voucher after insert or update or delete on public.payments for each row execute function public.payment_voucher_trigger();

create or replace function public.rebuild_supply_voucher(target_supply_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare s public.material_supplies%rowtype; v_id uuid; consumption numeric; site_name text;
begin
  delete from public.vouchers where source_type='supply' and source_id=target_supply_id;
  select * into s from public.material_supplies where id=target_supply_id;
  if not found then return; end if;
  select coalesce(sum(si.quantity*coalesce(m.standard_rate,si.rate)),0) into consumption from public.material_supply_items si left join public.materials m on m.id=si.material_id where si.supply_id=target_supply_id;
  if consumption=0 then return; end if;
  select name into site_name from public.sites where id=s.site_id;
  insert into public.vouchers(organization_id,voucher_no,voucher_type,voucher_date,party_name,reference,narration,source_type,source_id,is_locked,created_by)
  values(s.organization_id,s.issue_no,'journal',s.issue_date,site_name,s.vehicle_no,s.notes,'supply',s.id,true,s.created_by) returning id into v_id;
  insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(s.organization_id,'5100'),consumption,0,'Site material consumption');
  insert into public.voucher_lines(voucher_id,account_id,debit,credit,narration) values(v_id,public.system_account_id(s.organization_id,'1200'),0,consumption,'Inventory issued');
end;
$$;

create or replace function public.supply_voucher_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
begin perform public.rebuild_supply_voucher(coalesce(new.supply_id,old.supply_id)); return coalesce(new,old); end;
$$;

drop trigger if exists supply_items_rebuild_voucher on public.material_supply_items;
create trigger supply_items_rebuild_voucher after insert or update or delete on public.material_supply_items for each row execute function public.supply_voucher_trigger();

create or replace function public.available_material_stock(org_id uuid, target_material_id uuid, exclude_supply_item uuid default null, exclude_bill_item uuid default null)
returns numeric language sql stable security invoker set search_path = public as $$
  select m.opening_stock
    + coalesce((select sum(ri.quantity) from public.material_receipt_items ri join public.material_receipts r on r.id=ri.receipt_id where r.organization_id=org_id and r.destination='central_store' and ri.material_id=target_material_id),0)
    + coalesce((select sum(bi.quantity) from public.bill_items bi join public.bills b on b.id=bi.bill_id where b.organization_id=org_id and b.bill_type='purchase' and b.inventory_posting='auto_post' and bi.material_id=target_material_id and bi.id is distinct from exclude_bill_item),0)
    - coalesce((select sum(si.quantity) from public.material_supply_items si join public.material_supplies s on s.id=si.supply_id where s.organization_id=org_id and si.material_id=target_material_id and si.id is distinct from exclude_supply_item),0)
    - coalesce((select sum(bi.quantity) from public.bill_items bi join public.bills b on b.id=bi.bill_id where b.organization_id=org_id and b.bill_type='client' and b.inventory_posting='auto_post' and bi.material_id=target_material_id and bi.id is distinct from exclude_bill_item),0)
  from public.materials m where m.id=target_material_id and m.organization_id=org_id;
$$;

create or replace function public.prevent_negative_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare available numeric; org_id uuid; strict_mode boolean;
begin
  select organization_id into org_id from public.material_supplies where id=new.supply_id;
  select strict_stock_control into strict_mode from public.organizations where id=org_id;
  if not coalesce(strict_mode,true) then return new; end if;
  available := public.available_material_stock(org_id,new.material_id,new.id,null);
  if new.quantity>available then raise exception 'Insufficient stock. Available quantity: %',available; end if;
  return new;
end;
$$;

create or replace function public.prevent_negative_invoice_stock()
returns trigger language plpgsql security definer set search_path = public as $$
declare available numeric; org_id uuid; bill_kind public.bill_type; posting public.inventory_posting; strict_mode boolean;
begin
  select organization_id,bill_type,inventory_posting into org_id,bill_kind,posting from public.bills where id=new.bill_id;
  if bill_kind<>'client' or posting<>'auto_post' then return new; end if;
  select strict_stock_control into strict_mode from public.organizations where id=org_id;
  if not coalesce(strict_mode,true) then return new; end if;
  available := public.available_material_stock(org_id,new.material_id,null,new.id);
  if new.quantity>available then raise exception 'Insufficient stock for invoice. Available quantity: %',available; end if;
  return new;
end;
$$;

drop trigger if exists bill_item_stock_guard on public.bill_items;
create trigger bill_item_stock_guard before insert or update on public.bill_items for each row execute function public.prevent_negative_invoice_stock();

create or replace view public.inventory_summary with (security_invoker=true) as
select m.id,m.organization_id,m.code,m.name,m.category,m.unit,m.standard_rate,m.reorder_level,m.opening_stock,
  coalesce(r.received_qty,0) received_qty,
  coalesce(pb.purchased_qty,0) purchased_qty,
  coalesce(s.supplied_qty,0) supplied_qty,
  coalesce(cb.sold_qty,0) sold_qty,
  m.opening_stock+coalesce(r.received_qty,0)+coalesce(pb.purchased_qty,0)-coalesce(s.supplied_qty,0)-coalesce(cb.sold_qty,0) available_qty,
  (m.opening_stock+coalesce(r.received_qty,0)+coalesce(pb.purchased_qty,0)-coalesce(s.supplied_qty,0)-coalesce(cb.sold_qty,0))*m.standard_rate stock_value
from public.materials m
left join (select ri.material_id,sum(ri.quantity) received_qty from public.material_receipt_items ri join public.material_receipts mr on mr.id=ri.receipt_id where mr.destination='central_store' group by ri.material_id) r on r.material_id=m.id
left join (select bi.material_id,sum(bi.quantity) purchased_qty from public.bill_items bi join public.bills b on b.id=bi.bill_id where b.bill_type='purchase' and b.inventory_posting='auto_post' group by bi.material_id) pb on pb.material_id=m.id
left join (select material_id,sum(quantity) supplied_qty from public.material_supply_items group by material_id) s on s.material_id=m.id
left join (select bi.material_id,sum(bi.quantity) sold_qty from public.bill_items bi join public.bills b on b.id=bi.bill_id where b.bill_type='client' and b.inventory_posting='auto_post' group by bi.material_id) cb on cb.material_id=m.id;

create or replace view public.trial_balance with (security_invoker=true) as
select a.organization_id,a.id account_id,a.code,a.name,a.category,a.account_group,
  coalesce(sum(l.debit),0) debit_total,coalesce(sum(l.credit),0) credit_total,
  coalesce(sum(l.debit-l.credit),0) net_balance
from public.ledger_accounts a left join public.voucher_lines l on l.account_id=a.id
group by a.organization_id,a.id,a.code,a.name,a.category,a.account_group;

alter table public.ledger_accounts enable row level security;
alter table public.vouchers enable row level security;
alter table public.voucher_lines enable row level security;

create policy ledger_accounts_member_select on public.ledger_accounts for select using (public.is_org_member(organization_id));
create policy ledger_accounts_admin_write on public.ledger_accounts for all using (public.has_org_role(organization_id,array['owner','admin','accountant']::public.app_role[])) with check (public.has_org_role(organization_id,array['owner','admin','accountant']::public.app_role[]));
create policy vouchers_member_select on public.vouchers for select using (public.is_org_member(organization_id));
create policy vouchers_accounts_write on public.vouchers for all using (public.has_org_role(organization_id,array['owner','admin','accountant']::public.app_role[])) with check (public.has_org_role(organization_id,array['owner','admin','accountant']::public.app_role[]));
create policy voucher_lines_member_select on public.voucher_lines for select using (exists(select 1 from public.vouchers v where v.id=voucher_id and public.is_org_member(v.organization_id)));
create policy voucher_lines_accounts_write on public.voucher_lines for all using (exists(select 1 from public.vouchers v where v.id=voucher_id and public.has_org_role(v.organization_id,array['owner','admin','accountant']::public.app_role[]))) with check (exists(select 1 from public.vouchers v where v.id=voucher_id and public.has_org_role(v.organization_id,array['owner','admin','accountant']::public.app_role[])));

create trigger ledger_accounts_audit after insert or update or delete on public.ledger_accounts for each row execute function public.audit_row_changes();
create trigger vouchers_audit after insert or update or delete on public.vouchers for each row execute function public.audit_row_changes();

-- Backfill automatic vouchers for existing operational records.
select public.rebuild_bill_voucher(id) from public.bills;
select public.rebuild_payment_voucher(id) from public.payments;
select public.rebuild_supply_voucher(id) from public.material_supplies;

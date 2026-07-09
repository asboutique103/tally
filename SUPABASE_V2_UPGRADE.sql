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

drop trigger if exists ledger_accounts_set_updated_at on public.ledger_accounts;
drop trigger if exists vouchers_set_updated_at on public.vouchers;

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

drop policy if exists ledger_accounts_member_select on public.ledger_accounts;
drop policy if exists ledger_accounts_admin_write on public.ledger_accounts;
drop policy if exists vouchers_member_select on public.vouchers;
drop policy if exists vouchers_accounts_write on public.vouchers;
drop policy if exists voucher_lines_member_select on public.voucher_lines;
drop policy if exists voucher_lines_accounts_write on public.voucher_lines;

create policy ledger_accounts_member_select on public.ledger_accounts for select using (public.is_org_member(organization_id));
create policy ledger_accounts_admin_write on public.ledger_accounts for all using (public.has_org_role(organization_id,array['owner','admin','accountant']::public.app_role[])) with check (public.has_org_role(organization_id,array['owner','admin','accountant']::public.app_role[]));
create policy vouchers_member_select on public.vouchers for select using (public.is_org_member(organization_id));
create policy vouchers_accounts_write on public.vouchers for all using (public.has_org_role(organization_id,array['owner','admin','accountant']::public.app_role[])) with check (public.has_org_role(organization_id,array['owner','admin','accountant']::public.app_role[]));
create policy voucher_lines_member_select on public.voucher_lines for select using (exists(select 1 from public.vouchers v where v.id=voucher_id and public.is_org_member(v.organization_id)));
create policy voucher_lines_accounts_write on public.voucher_lines for all using (exists(select 1 from public.vouchers v where v.id=voucher_id and public.has_org_role(v.organization_id,array['owner','admin','accountant']::public.app_role[]))) with check (exists(select 1 from public.vouchers v where v.id=voucher_id and public.has_org_role(v.organization_id,array['owner','admin','accountant']::public.app_role[])));

drop trigger if exists ledger_accounts_audit on public.ledger_accounts;
drop trigger if exists vouchers_audit on public.vouchers;

create trigger ledger_accounts_audit after insert or update or delete on public.ledger_accounts for each row execute function public.audit_row_changes();
create trigger vouchers_audit after insert or update or delete on public.vouchers for each row execute function public.audit_row_changes();

-- Backfill automatic vouchers for existing operational records.
select public.rebuild_bill_voucher(id) from public.bills;
select public.rebuild_payment_voucher(id) from public.payments;
select public.rebuild_supply_voucher(id) from public.material_supplies;

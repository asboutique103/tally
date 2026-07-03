# Supabase Setup — ConstructFlow Enterprise v2.0

## 1. Create the project

Create a Supabase project and keep the database password secure.

## 2. Run the SQL

Open **SQL Editor** and run the following files in this exact order:

1. `supabase/migrations/20260703_000001_constructflow_schema.sql`
2. `supabase/migrations/20260703_000002_enterprise_accounting.sql`

For a brand-new database, the combined `ConstructFlow-Supabase-Full-Schema-v2.sql` file may also be run once instead.

The SQL creates:

- Organizations and multi-user roles
- Suppliers, projects, materials, GRNs, issues, bills and payments
- Ledger accounts, vouchers and voucher lines
- Server-side automatic voucher posting
- Invoice-driven inventory posting
- Negative-stock protection
- Bill balance, inventory and trial-balance views
- Row Level Security policies
- Audit logs and private document storage

## 3. Create the first user

Go to **Authentication → Users** and create the owner user, or enable an authentication provider and sign up through the application after cloud login is connected.

## 4. Create the organization

Sign in as the owner user, then run:

```sql
select public.create_my_organization('Your Construction Company Name');
```

This also creates the default chart of accounts.

Verify:

```sql
select
  om.organization_id,
  o.name,
  om.user_id,
  om.role
from public.organization_members om
join public.organizations o on o.id = om.organization_id;
```

## 5. Add users and roles

Create each person in **Authentication → Users**, copy the user UUID, then run:

```sql
insert into public.organization_members (
  organization_id,
  user_id,
  role
)
values (
  'ORGANIZATION_UUID',
  'USER_UUID',
  'accountant'
);
```

Supported roles:

- `owner`
- `admin`
- `accountant`
- `storekeeper`
- `site_engineer`
- `viewer`

## 6. Configure the frontend

Copy `.env.example` to `.env` and enter:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```

Use only the anon public key in the frontend. Never expose the service-role key.

## 7. Invoice and stock behavior

The `bills.inventory_posting` field controls inventory:

- `auto_post`: purchase invoices increase stock; client invoices decrease stock.
- `accounting_only`: accounting and GST are posted without moving stock.

Recommended physical-receipt process:

- Use GRN + accounting-only supplier invoice when the material is physically received before the invoice.
- Use auto-post purchase invoice when the invoice itself is the stock receipt document.

This prevents accidental double posting.

## 8. Test before live use

Perform these tests with a temporary organization:

1. Add a material with opening stock.
2. Create an auto-post purchase invoice and verify `inventory_summary` increases.
3. Create an auto-post client invoice and verify stock decreases.
4. Try invoicing more than available stock and confirm it is blocked.
5. Record a payment and verify the bill status and voucher.
6. Run:

```sql
select * from public.inventory_summary;
select * from public.bill_balances;
select * from public.trial_balance;
select * from public.vouchers order by voucher_date desc;
```

7. Confirm debits equal credits:

```sql
select
  v.voucher_no,
  sum(vl.debit) as debit,
  sum(vl.credit) as credit
from public.vouchers v
join public.voucher_lines vl on vl.voucher_id = v.id
group by v.id, v.voucher_no
having abs(sum(vl.debit) - sum(vl.credit)) > 0.01;
```

The final query must return no rows.

## 9. Production requirements not solved by SQL alone

Direct GST filing, e-invoice, e-way bill, connected banking, payroll statutory filing, WhatsApp delivery and OCR require external providers, credentials and compliance testing. Do not put provider secrets in the browser; use Supabase Edge Functions or another secure backend.

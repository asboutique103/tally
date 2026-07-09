# Supabase Setup - ConstructFlow Enterprise v2.0

## 1. Create the project

Create a Supabase project and keep the database password secure.

## 2. Run the SQL

Open **SQL Editor** and run:

1. `SUPABASE_FULL_SCHEMA_V2.sql`
2. `SUPABASE_APP_STATE.sql`

Run `SUPABASE_APP_STATE.sql` for both new and existing databases. It is safe to run more than once and creates the protected app login/session functions used by the browser app.

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
- `app_users` username/password login
- Protected `app_state` cloud persistence for the browser app workspace

## 3. First login

`SUPABASE_APP_STATE.sql` creates the first app user:

- Username: `Admin`
- Password: `Admin@766`
- Role: `owner`

Use this login in the app. Do not create a shared Supabase Auth user for browser sync.

## 4. Optional organization tables

```sql
select public.create_my_organization('Your Construction Company Name');
```

The browser app saves the complete workspace through protected `app_state` RPC functions. The normalized organization tables are available for future direct database workflows and reporting.

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

## 5. Add app users and roles

Add users to `public.app_users`. Passwords must be stored with `crypt`:

```sql
insert into public.app_users (
  username,
  password_hash,
  role,
  is_active
)
values (
  'StoreUser',
  crypt('StrongPasswordHere', gen_salt('bf')),
  'storekeeper',
  true
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
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```

Use only the anon public key in the frontend. Never expose the service-role key.

When Supabase mode is enabled:

- Sign in with a username and password from `public.app_users`.
- The app loads from `public.app_state` through protected RPC functions after sign-in.
- Every supplier, site, material, receipt, issue, bill, payment, setting, attendance entry and audit entry is saved back to Supabase as JSON workspace state.
- Browser local storage is only used as a cache/local mode store. In Supabase mode, failed cloud saves are not silently treated as successful.

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
6. Confirm the browser app creates/updates one row in `public.app_state`.
7. Run:

```sql
select * from public.inventory_summary;
select * from public.bill_balances;
select * from public.trial_balance;
select * from public.vouchers order by voucher_date desc;
select workspace_key, version, updated_at from public.app_state;
```

8. Confirm debits equal credits:

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

The final debit/credit query must return no rows.

## 9. Production requirements not solved by SQL alone

Direct GST filing, e-invoice, e-way bill, connected banking, payroll statutory filing, WhatsApp delivery and OCR require external providers, credentials and compliance testing. Do not put provider secrets in the browser; use Supabase Edge Functions or another secure backend.

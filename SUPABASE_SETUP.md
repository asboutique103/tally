# Supabase production setup

This code targets the existing relational **Tally** Supabase database. It is not
a blank-project bootstrap and it must not be pointed at an unrelated project.

## 1. Confirm the target

Verify the project reference in `VITE_SUPABASE_URL` and in the Supabase CLI
before making any database change. Back up the database first. Do not run any of
the retired root SQL files; they are harmless no-op markers retained only for
old automation.

## 2. Review and apply the migration

The reviewed migration is in `supabase/migrations/`. It is based on the live
Tally schema that existed when this release was audited. Review it in a staging
branch or restored backup, then apply it through the normal Supabase migration
workflow. Do not paste isolated sections into production.

The migration:

- enforces module-level roles for every write RPC;
- revokes direct access to internal and legacy functions;
- serializes failed login attempts and preserves account lockout;
- adds password change support and invalidates other sessions;
- scopes payroll deduction decisions to a month or week;
- blocks overpayments, wrong payment directions, and unsafe deletions;
- prevents deletion of automatic or locked vouchers;
- normalizes salary-advance dates and voucher source values;
- sets views to security-invoker mode and adds missing foreign-key indexes;
- explicitly grants only the browser RPC surface; and
- keeps the application currency fixed to INR for this GST build.

Applying the migration is a separate production database operation. Merely
deploying the frontend does not change SQL.

## 3. Configure the frontend

```env
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Never place the database password or service-role key in frontend variables.
No default application password is included in this repository. Create or
rotate production users through a controlled administrative process and require
unique passwords of at least 12 characters.

## 4. Verify before release

On staging, test each application role and confirm that permitted actions work
and forbidden RPC calls fail. At minimum test login lockout, session expiry,
password change, stock control, bill/payment deletion rules, overpayment
rejection, automatic voucher protection, monthly and weekly payroll decisions,
and debit/credit balance.

Run Supabase Security and Performance Advisors after applying the migration.
Resolve any new errors before production. Then run the frontend validation:

```bash
npm run lint
npm test
npm run build
```

## 5. Operational requirements

Use HTTPS, protected backups, restricted dashboard access, environment-specific
credentials, and monitoring. GST filing, e-invoicing, e-way bills, banking,
statutory payroll filing, messaging, and OCR require separately secured provider
integrations and compliance testing.

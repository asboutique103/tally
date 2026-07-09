# ConstructFlow Enterprise v2.0

Construction ERP combining materials, stock, supplier billing, client invoicing, payments, double-entry accounting, project consumption and audit control.

## What is functional now

- Material, supplier and construction-site masters
- Goods receipt notes and direct-to-site receipts
- Material issue notes with strict negative-stock control
- Purchase invoices and client invoices
- **Invoice-to-stock synchronization**
  - Purchase invoice + `Auto Post` adds quantities to central stock
  - Client invoice + `Auto Post` deducts quantities from central stock
  - `Accounting Only` posts finance and GST without moving stock
- Invoice-to-accounting synchronization
  - Purchase/client invoices automatically create balanced vouchers
  - Payments and collections automatically update cash/bank and receivable/payable accounts
  - Site issues automatically post material consumption against inventory
- Stock movement ledger with document-level traceability and running balance
- Day Book, General Ledger, Trial Balance, Profit & Loss and Balance Sheet
- Manual Journal, Contra, Receipt, Payment, Debit Note and Credit Note vouchers
- Supplier payable ledger and client/project billing
- GST/tax summary
- Audit trail for creation, updates and deletions
- Responsive desktop, tablet and mobile UI
- Blank local workspace mode and Supabase-ready schema

## Run locally

```bash
npm install
npm run dev
```

Production validation:

```bash
npm run lint
npm run build
npm run preview
```

## Supabase

For a new database, run:

1. `SUPABASE_FULL_SCHEMA_V2.sql`
2. `SUPABASE_APP_STATE.sql`

Set `VITE_USE_SUPABASE=true`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` in your environment. In Supabase mode, login uses the `public.app_users` table and protected RPC sessions. The default seeded login is username `Admin` and password `Admin@766`; change it after first sign-in if this is a live workspace.

## Important accounting behavior

A physical delivery should normally be entered as either:

- GRN followed by an `Accounting Only` supplier invoice, or
- a purchase invoice with `Auto Post` when no separate GRN is used.

Do not auto-post both a GRN and the matching purchase invoice, otherwise the same physical quantity is intentionally counted twice. This choice exists because many construction companies receive materials before the supplier invoice arrives.

## Hosting

This app uses `BrowserRouter`. Configure the host to rewrite unknown routes to `index.html`.

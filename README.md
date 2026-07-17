# ConstructFlow Enterprise v2.0.1

Construction ERP for materials, stock, suppliers, project billing, payments,
double-entry accounting, payroll, and audit control.

## Development

Requirements: Node.js 20+ and npm 10+.

```bash
npm install
npm run dev
```

When `VITE_USE_SUPABASE` is not `true`, local workspace mode is available only
from the Vite development server. It is intentionally disabled in production.

## Production configuration

Set all of these variables in the hosting environment:

```env
VITE_USE_SUPABASE=true
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Use the Supabase public anon key only. Never expose a service-role key in the
frontend. A production build with missing cloud configuration fails closed and
does not create a local Owner session.

Before deployment, follow `SUPABASE_SETUP.md`, then run:

```bash
npm run lint
npm test
npm run build
```

## Database architecture

The frontend uses the existing relational Tally schema through protected RPC
functions. It does not use `app_state` JSON storage. The old root SQL filenames
are retired no-op markers so an outdated runbook cannot install the wrong
schema or reset an application password.

## Accounting behavior

A physical delivery should normally be entered as either:

- a GRN followed by an `Accounting Only` supplier invoice, or
- a purchase invoice with `Auto Post` when no separate GRN is used.

Do not auto-post both a GRN and its matching purchase invoice, because that
records the physical quantity twice. Automatic accounting vouchers are created
by database triggers and cannot be deleted directly.

## Hosting

`vercel.json` provides SPA rewrites and production security headers. For another
host, rewrite unknown routes to `index.html`, serve only over HTTPS, and apply an
equivalent Content Security Policy.

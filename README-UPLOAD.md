# VMV Enterprise — GitHub changed files only

This folder contains only the files that must be added or replaced in the existing `tally-main` GitHub repository.

## Upload

1. Open the root of the existing `tally-main` repository.
2. Upload the `src` folder and `vite.config.ts` from this package.
3. Allow GitHub to replace files with the same names.
4. Keep the folder structure exactly as supplied.
5. Commit the changes and redeploy the project in Vercel.

Do not upload `README-UPLOAD.md` unless you want these instructions stored in the repository.

## Included fixes and features

- Attendance Excel export shows Absent in red.
- Attendance export includes Absent, Earned, Advance Deduction, Other Deduction, Total Deductions and Net Payable.
- Salary screen correctly displays deductions and net payable.
- Non-Labor staff support 1.5× and 2× payable-day attendance.
- Groups tab supports group head, members, roles, attendance and salary summaries.
- Direct Customer invoices support GST, IGST, full payment, partial payment and credit sale.
- Full and partial receipts are added automatically to Payments.
- Credit tracker shows outstanding, overdue and collected amounts.
- Invoice/logo paths work in Vercel and packaged applications.
- Supabase accepts either the publishable key or legacy anon key environment variable.

## Vercel environment variables

Keep the existing Supabase values configured in Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`

No SQL change is required for this update.

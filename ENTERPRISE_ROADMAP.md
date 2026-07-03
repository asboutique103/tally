# ConstructFlow Enterprise Product Roadmap

## Delivered in v2.0

Integrated perpetual inventory, invoices, receivables/payables, payments, double-entry vouchers, audit trail, project consumption and core financial statements.

## Required for full enterprise/Tally-class coverage

### Statutory India suite
- GST return preparation and reconciliation for GSTR-1, GSTR-3B, GSTR-2B and IMS
- E-invoice IRN and QR-code generation through a licensed GSP/ASP
- E-way bill integration
- TDS/TCS deduction, certificates and return files
- HSN/SAC validation and place-of-supply controls
- Multi-GST registration per company

### Banking and treasury
- Bank statement import and reconciliation rules
- Cheque lifecycle and post-dated instruments
- Payment approval workflows
- Connected banking integrations through supported bank APIs
- Cash-flow forecasting and ageing

### Construction controls beyond Tally
- BOQ, estimates, tender comparison and rate analysis
- Purchase requisition, RFQ, purchase order and approval hierarchy
- GRN quality inspection and three-way matching: PO vs GRN vs supplier invoice
- Subcontractor work orders, measurement books, RA bills and retention
- Labour attendance, payroll, advances and statutory deductions
- Equipment, fuel, maintenance and depreciation
- Site petty cash and imprest settlement
- Material indents, transfers, returns, wastage and scrap
- Project budget vs commitment vs actual cost
- Client billing milestones, certification and retention receivable

### Enterprise platform
- Supabase authentication and live multi-user data
- Role/permission designer and approval matrix
- Document attachments and OCR invoice capture
- Notifications by email, WhatsApp and mobile push
- Scheduled encrypted backups and restore testing
- Offline-first mobile site application and synchronization
- API/webhooks, import/export and Tally data migration tools
- Automated tests, observability, error reporting and disaster recovery

These modules should be built as controlled releases because tax filing, banking, payroll and e-invoice functions require external credentials, licensed APIs and compliance testing. They should not be represented as production-ready until those integrations are configured and certified.

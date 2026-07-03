import type { AppData } from '../types';

const now = new Date().toISOString();

export const seedData: AppData = {
  suppliers: [
    { id: 'sup-1', code: 'SUP-001', name: 'Sri Balaji Cement Traders', contactPerson: 'Ramesh Kumar', phone: '9876543210', email: 'accounts@balajicement.in', gstin: '33ABCDE1234F1Z5', address: 'SIDCO Industrial Estate, Hosur', openingBalance: 85000, status: 'Active', createdAt: now },
    { id: 'sup-2', code: 'SUP-002', name: 'Kaveri Steel Corporation', contactPerson: 'Naveen', phone: '9840011223', email: 'sales@kaveristeel.in', gstin: '33AAACK7788Q1Z2', address: 'Guindy, Chennai', openingBalance: 124000, status: 'Active', createdAt: now },
    { id: 'sup-3', code: 'SUP-003', name: 'Metro M-Sand Suppliers', contactPerson: 'Farooq', phone: '9790019944', email: '', gstin: '33BBFPM2020R1ZX', address: 'Krishnagiri Main Road, Hosur', openingBalance: 32000, status: 'Active', createdAt: now },
  ],
  sites: [
    { id: 'site-1', code: 'SITE-001', name: 'Green Heights Apartment', clientName: 'Arun Developers', location: 'Electronic City, Bengaluru', siteEngineer: 'Manoj', phone: '9884488822', budget: 25000000, startDate: '2026-04-01', expectedEndDate: '2027-06-30', status: 'Active', createdAt: now },
    { id: 'site-2', code: 'SITE-002', name: 'Aadhvik Commercial Complex', clientName: 'Aadhvik Properties', location: 'Hosur', siteEngineer: 'Sathish', phone: '9791992299', budget: 12000000, startDate: '2026-05-15', expectedEndDate: '2027-02-28', status: 'Active', createdAt: now },
  ],
  materials: [
    { id: 'mat-1', code: 'MAT-001', name: 'OPC Cement 53 Grade', category: 'Cement', unit: 'Bag', standardRate: 410, taxRate: 28, reorderLevel: 100, openingStock: 250, location: 'Rack A1', createdAt: now },
    { id: 'mat-2', code: 'MAT-002', name: 'TMT Steel 12mm', category: 'Steel', unit: 'KG', standardRate: 68, taxRate: 18, reorderLevel: 1000, openingStock: 4500, location: 'Yard S2', createdAt: now },
    { id: 'mat-3', code: 'MAT-003', name: 'M-Sand', category: 'Aggregates', unit: 'Cft', standardRate: 58, taxRate: 5, reorderLevel: 500, openingStock: 1800, location: 'Open Yard', createdAt: now },
    { id: 'mat-4', code: 'MAT-004', name: '20mm Blue Metal', category: 'Aggregates', unit: 'Cft', standardRate: 62, taxRate: 5, reorderLevel: 400, openingStock: 1200, location: 'Open Yard', createdAt: now },
    { id: 'mat-5', code: 'MAT-005', name: 'Red Clay Brick', category: 'Masonry', unit: 'Nos', standardRate: 9.5, taxRate: 5, reorderLevel: 3000, openingStock: 8000, location: 'Yard B1', createdAt: now },
  ],
  receipts: [
    { id: 'rec-1', receiptNo: 'GRN-0001', date: '2026-07-01', supplierId: 'sup-1', invoiceNo: 'SBCT/7721', vehicleNo: 'TN 70 AB 1290', receivedBy: 'Store Admin', destination: 'Central Store', items: [{ id: 'ri-1', materialId: 'mat-1', quantity: 300, rate: 405, taxRate: 28 }], notes: 'Verified quantity and batch.', createdAt: now },
    { id: 'rec-2', receiptNo: 'GRN-0002', date: '2026-07-02', supplierId: 'sup-2', invoiceNo: 'KSC/4518', vehicleNo: 'TN 24 K 8821', receivedBy: 'Store Admin', destination: 'Central Store', items: [{ id: 'ri-2', materialId: 'mat-2', quantity: 3000, rate: 67.5, taxRate: 18 }], notes: 'Weighbridge slip received.', createdAt: now },
  ],
  supplies: [
    { id: 'iss-1', issueNo: 'ISS-0001', date: '2026-07-02', siteId: 'site-1', requestedBy: 'Manoj', approvedBy: 'Project Manager', vehicleNo: 'KA 51 MN 1122', driverName: 'Prakash', items: [{ id: 'si-1', materialId: 'mat-1', quantity: 180, rate: 410, taxRate: 28 }, { id: 'si-2', materialId: 'mat-2', quantity: 1200, rate: 68, taxRate: 18 }], notes: 'For Block A slab work.', createdAt: now },
    { id: 'iss-2', issueNo: 'ISS-0002', date: '2026-07-03', siteId: 'site-2', requestedBy: 'Sathish', approvedBy: 'Project Manager', vehicleNo: 'TN 70 Q 2233', driverName: 'Kumar', items: [{ id: 'si-3', materialId: 'mat-3', quantity: 650, rate: 58, taxRate: 5 }, { id: 'si-4', materialId: 'mat-5', quantity: 2500, rate: 9.5, taxRate: 5 }], notes: 'Ground floor masonry.', createdAt: now },
  ],
  bills: [
    { id: 'bill-1', billNo: 'PB-0001', type: 'Purchase', date: '2026-07-01', dueDate: '2026-07-31', supplierId: 'sup-1', partyName: 'Sri Balaji Cement Traders', referenceNo: 'SBCT/7721', items: [{ id: 'bi-1', materialId: 'mat-1', quantity: 300, rate: 405, taxRate: 28 }], discount: 0, otherCharges: 2500, notes: 'Freight included separately.', status: 'Partially Paid', inventoryPosting: 'Accounting Only', createdAt: now },
    { id: 'bill-2', billNo: 'PB-0002', type: 'Purchase', date: '2026-07-02', dueDate: '2026-07-20', supplierId: 'sup-2', partyName: 'Kaveri Steel Corporation', referenceNo: 'KSC/4518', items: [{ id: 'bi-2', materialId: 'mat-2', quantity: 3000, rate: 67.5, taxRate: 18 }], discount: 1500, otherCharges: 1800, notes: '', status: 'Unpaid', inventoryPosting: 'Accounting Only', createdAt: now },
  ],
  payments: [
    { id: 'pay-1', paymentNo: 'PAY-0001', date: '2026-07-02', billId: 'bill-1', partyName: 'Sri Balaji Cement Traders', direction: 'Paid', amount: 50000, mode: 'Bank Transfer', reference: 'UTR001928881', notes: 'Advance settlement.', createdAt: now },
  ],

  accounts: [
    { id: 'acc-cash', code: '1000', name: 'Cash in Hand', category: 'Asset', group: 'Cash & Bank', openingBalance: 150000, createdAt: now },
    { id: 'acc-bank', code: '1010', name: 'Primary Bank Account', category: 'Asset', group: 'Cash & Bank', openingBalance: 750000, createdAt: now },
    { id: 'acc-receivable', code: '1100', name: 'Accounts Receivable', category: 'Asset', group: 'Current Assets', openingBalance: 0, createdAt: now },
    { id: 'acc-inventory', code: '1200', name: 'Inventory Asset', category: 'Asset', group: 'Current Assets', openingBalance: 0, createdAt: now },
    { id: 'acc-input-gst', code: '1300', name: 'Input GST Credit', category: 'Asset', group: 'Duties & Taxes', openingBalance: 0, createdAt: now },
    { id: 'acc-payable', code: '2000', name: 'Accounts Payable', category: 'Liability', group: 'Current Liabilities', openingBalance: 0, createdAt: now },
    { id: 'acc-output-gst', code: '2100', name: 'Output GST Payable', category: 'Liability', group: 'Duties & Taxes', openingBalance: 0, createdAt: now },
    { id: 'acc-equity', code: '3000', name: 'Opening Balance Equity', category: 'Equity', group: 'Capital Account', openingBalance: 0, createdAt: now },
    { id: 'acc-sales', code: '4000', name: 'Construction Revenue', category: 'Income', group: 'Direct Income', openingBalance: 0, createdAt: now },
    { id: 'acc-other-income', code: '4100', name: 'Other Income', category: 'Income', group: 'Indirect Income', openingBalance: 0, createdAt: now },
    { id: 'acc-purchases', code: '5000', name: 'Material Purchases', category: 'Expense', group: 'Direct Expenses', openingBalance: 0, createdAt: now },
    { id: 'acc-site-expense', code: '5100', name: 'Site Material Consumption', category: 'Expense', group: 'Direct Expenses', openingBalance: 0, createdAt: now },
    { id: 'acc-other-charges', code: '5200', name: 'Freight & Other Charges', category: 'Expense', group: 'Direct Expenses', openingBalance: 0, createdAt: now },
    { id: 'acc-discount-received', code: '4200', name: 'Discount Received', category: 'Income', group: 'Indirect Income', openingBalance: 0, createdAt: now },
    { id: 'acc-discount-allowed', code: '5300', name: 'Discount Allowed', category: 'Expense', group: 'Indirect Expenses', openingBalance: 0, createdAt: now },
  ],
  vouchers: [],
  auditLog: [
    { id: 'audit-1', timestamp: now, actor: 'System', action: 'Created', module: 'Company', documentNo: 'INIT', details: 'ConstructFlow enterprise accounting workspace initialized.' },
  ],
  settings: {
    companyName: 'VMV Construction Project Private Limited',
    gstin: '33AACCC9090A1Z1',
    phone: '+91 98765 43210',
    email: 'accounts@constructflow.in',
    address: 'Hosur, Tamil Nadu, India',
    currency: 'INR',
    defaultTaxRate: 18,
    lowStockAlerts: true,
    financialYearStart: '2026-04-01',
    invoicePrefix: 'CF',
    strictStockControl: true,
  },
};

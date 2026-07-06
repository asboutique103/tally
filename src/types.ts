export type Id = string;
export type Unit = 'KG' | 'Ltr' | 'Pcs' | 'Nos' | 'Bag' | 'Box' | 'Cft' | 'Sqft' | 'Mtr' | 'Load';
export type PaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid' | 'Overdue';
export type BillType = 'Purchase' | 'Client';
export type Role = 'Owner' | 'Admin' | 'Accountant' | 'Storekeeper' | 'Site Engineer' | 'Viewer';
export type InventoryPosting = 'Auto Post' | 'Accounting Only';
export type AccountCategory = 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
export type VoucherType = 'Journal' | 'Contra' | 'Receipt' | 'Payment' | 'Debit Note' | 'Credit Note' | 'Opening';

export interface Supplier {
  id: Id;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  gstin: string;
  address: string;
  openingBalance: number;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface Site {
  id: Id;
  code: string;
  name: string;
  clientName: string;
  location: string;
  siteEngineer: string;
  phone: string;
  budget: number;
  startDate: string;
  expectedEndDate: string;
  status: 'Planning' | 'Active' | 'On Hold' | 'Completed';
  createdAt: string;
}

export interface Material {
  id: Id;
  code: string;
  name: string;
  category: string;
  hsnCode?: string;
  unit: Unit;
  standardRate: number;
  taxRate: number;
  reorderLevel: number;
  openingStock: number;
  location: string;
  createdAt: string;
}

export interface TransactionItem {
  id: Id;
  materialId: Id;
  quantity: number;
  rate: number;
  taxRate: number;
  note?: string;
}

export interface Receipt {
  id: Id;
  receiptNo: string;
  date: string;
  supplierId: Id;
  invoiceNo: string;
  vehicleNo: string;
  receivedBy: string;
  destination: 'Central Store' | 'Direct to Site';
  siteId?: Id;
  items: TransactionItem[];
  notes: string;
  attachmentName?: string;
  createdAt: string;
}

export interface Supply {
  id: Id;
  issueNo: string;
  date: string;
  siteId: Id;
  requestedBy: string;
  approvedBy: string;
  vehicleNo: string;
  driverName: string;
  items: TransactionItem[];
  notes: string;
  createdAt: string;
}

export interface Bill {
  id: Id;
  billNo: string;
  type: BillType;
  date: string;
  dueDate: string;
  supplierId?: Id;
  siteId?: Id;
  partyName: string;
  partyAddress?: string;
  partyGstin?: string;
  state?: string;
  deliveryAddress?: string;
  ewayBillNo?: string;
  vehicleNo?: string;
  referenceNo: string;
  items: TransactionItem[];
  discount: number;
  otherCharges: number;
  notes: string;
  status: PaymentStatus;
  inventoryPosting: InventoryPosting;
  createdAt: string;
}

export interface Payment {
  id: Id;
  paymentNo: string;
  date: string;
  billId: Id;
  partyName: string;
  direction: 'Paid' | 'Received';
  amount: number;
  mode: 'Cash' | 'Bank Transfer' | 'Cheque' | 'UPI' | 'Card';
  reference: string;
  notes: string;
  createdAt: string;
}

export interface LedgerAccount {
  id: Id;
  code: string;
  name: string;
  category: AccountCategory;
  group: string;
  openingBalance: number;
  createdAt: string;
}

export interface VoucherLine {
  id: Id;
  accountId: Id;
  debit: number;
  credit: number;
  narration?: string;
}

export interface Voucher {
  id: Id;
  voucherNo: string;
  type: VoucherType;
  date: string;
  partyName: string;
  reference: string;
  narration: string;
  lines: VoucherLine[];
  sourceType?: 'Bill' | 'Payment' | 'Opening' | 'Manual';
  sourceId?: Id;
  createdAt: string;
}

export interface AuditEntry {
  id: Id;
  timestamp: string;
  actor: string;
  action: 'Created' | 'Updated' | 'Deleted' | 'Reset';
  module: string;
  documentNo: string;
  details: string;
}

export type StaffBranch = 'Head Office' | 'Site' | 'Store' | 'Admin';

export interface Employee {
  id: Id;
  code: string;
  name: string;
  branch: StaffBranch;
  department: string;
  grossSalary: number;
  salaryAdvance: number;
  otherDeduction: number;
  accountNumber?: string;
  bankName?: string;
  ifscCode?: string;
  status: 'Active' | 'Inactive';
  createdAt: string;
}

export interface DayAttendance {
  present: boolean;
  half: boolean;
  woff: boolean;
  absent?: boolean;
}

export type MonthAttendance = Record<string, DayAttendance>;

export interface SalaryAdvance {
  id: Id;
  employeeId: Id;
  amount: number;
  givenDate: string;
  note?: string;
  cleared: boolean;
  createdAt: string;
}

export interface DeductionDecision {
  deductAdvance: boolean;
  deductOther: boolean;
}

export type DeductionDecisions = Record<string, DeductionDecision>;

export interface AppSettings {
  companyName: string;
  gstin: string;
  panNo?: string;
  phone: string;
  email: string;
  address: string;
  bankName?: string;
  bankBranch?: string;
  bankAccountNo?: string;
  bankIfsc?: string;
  currency: string;
  defaultTaxRate: number;
  lowStockAlerts: boolean;
  financialYearStart: string;
  invoicePrefix: string;
  strictStockControl: boolean;
}

export interface AppData {
  suppliers: Supplier[];
  sites: Site[];
  materials: Material[];
  receipts: Receipt[];
  supplies: Supply[];
  bills: Bill[];
  payments: Payment[];
  accounts: LedgerAccount[];
  vouchers: Voucher[];
  auditLog: AuditEntry[];
  settings: AppSettings;
  employees: Employee[];
  attendance: MonthAttendance;
  salaryAdvances: SalaryAdvance[];
  deductionDecisions: DeductionDecisions;
}

export interface InventoryRow extends Material {
  receivedQty: number;
  purchasedQty: number;
  suppliedQty: number;
  soldQty: number;
  availableQty: number;
  stockValue: number;
}

export interface StockMovement {
  id: Id;
  date: string;
  documentNo: string;
  source: 'Opening' | 'GRN' | 'Purchase Invoice' | 'Issue' | 'Client Invoice';
  materialId: Id;
  siteId?: Id;
  inward: number;
  outward: number;
  rate: number;
  value: number;
  note: string;
}

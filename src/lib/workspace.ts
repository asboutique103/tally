import { seedData } from '../data/seed';
import { billTotal, inventoryRows, receiptTotal, supplyTotal, today, voucherTotals } from './helpers';
import type { AppData, AuditEntry, Payment, PaymentStatus, Voucher } from '../types';

const LOCAL_WORKSPACE_KEY = 'constructflow-workspace-v5';

const ARRAY_KEYS: Array<keyof AppData> = [
  'suppliers', 'sites', 'materials', 'receipts', 'supplies', 'bills', 'payments',
  'accounts', 'vouchers', 'auditLog', 'employees', 'salaryAdvances',
];

const OBJECT_KEYS: Array<keyof AppData> = ['attendance', 'deductionDecisions'];

export interface WorkspaceAudit {
  action: AuditEntry['action'];
  module: string;
  documentNo: string;
  details: string;
}

export const normalizeWorkspace = (value: unknown): AppData => {
  const source = value && typeof value === 'object' ? value as Partial<AppData> : {};
  const normalized = structuredClone(seedData);

  for (const key of ARRAY_KEYS) {
    const candidate = source[key];
    if (Array.isArray(candidate)) {
      (normalized as unknown as Record<string, unknown>)[key] = candidate;
    }
  }
  for (const key of OBJECT_KEYS) {
    const candidate = source[key];
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      (normalized as unknown as Record<string, unknown>)[key] = candidate;
    }
  }
  if (source.settings && typeof source.settings === 'object') {
    normalized.settings = { ...normalized.settings, ...source.settings };
  }
  const voucherSources: Record<string, Voucher['sourceType']> = {
    bill: 'Bill', payment: 'Payment', supply: 'Supply', opening: 'Opening', manual: 'Manual',
  };
  normalized.vouchers = normalized.vouchers.map((voucher) => ({
    ...voucher,
    sourceType: voucherSources[String(voucher.sourceType ?? 'manual').toLowerCase()] ?? 'Manual',
  }));
  normalized.salaryAdvances = normalized.salaryAdvances.map((advance) => {
    const legacy = advance as typeof advance & { date?: string };
    const givenDate = advance.givenDate || legacy.date || '';
    return { ...advance, givenDate, createdAt: advance.createdAt || givenDate };
  });
  if (!normalized.accounts.length) normalized.accounts = structuredClone(seedData.accounts);
  return recalculateBillStatuses(normalized);
};

export const loadLocalWorkspace = (): AppData => {
  try {
    const raw = localStorage.getItem(LOCAL_WORKSPACE_KEY);
    return normalizeWorkspace(raw ? JSON.parse(raw) : seedData);
  } catch {
    localStorage.removeItem(LOCAL_WORKSPACE_KEY);
    return normalizeWorkspace(seedData);
  }
};

export const saveLocalWorkspace = (data: AppData) => {
  localStorage.setItem(LOCAL_WORKSPACE_KEY, JSON.stringify(data));
};

export const appendAudit = (data: AppData, actor: string, audit: WorkspaceAudit): AppData => ({
  ...data,
  auditLog: [{
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    actor,
    ...audit,
  }, ...data.auditLog].slice(0, 5000),
});

export const recalculateBillStatuses = (data: AppData): AppData => ({
  ...data,
  bills: data.bills.map((bill) => {
    const paid = data.payments
      .filter((payment) => payment.category === 'Bill' && payment.targetId === bill.id)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const total = billTotal(bill);
    let status: PaymentStatus = 'Unpaid';
    if (total > 0 && paid >= total - 0.005) status = 'Paid';
    else if (paid > 0) status = 'Partially Paid';
    else if (bill.dueDate && bill.dueDate < today()) status = 'Overdue';
    return { ...bill, status };
  }),
});

const duplicateValue = (values: string[]) => {
  const seen = new Set<string>();
  return values.find((value) => {
    const normalized = value.trim().toUpperCase();
    if (seen.has(normalized)) return true;
    seen.add(normalized);
    return false;
  });
};

const targetForPayment = (data: AppData, payment: Payment) => {
  if (payment.category === 'Bill') {
    const bill = data.bills.find((item) => item.id === payment.targetId);
    return bill ? { total: billTotal(bill), direction: bill.type === 'Client' ? 'Received' : 'Paid' } as const : null;
  }
  if (payment.category === 'Supply') {
    const supply = data.supplies.find((item) => item.id === payment.targetId);
    return supply ? { total: supplyTotal(supply), direction: 'Received' } as const : null;
  }
  if (payment.category === 'Receipt') {
    const receipt = data.receipts.find((item) => item.id === payment.targetId);
    return receipt ? { total: receiptTotal(receipt), direction: 'Paid' } as const : null;
  }
  const employee = data.employees.find((item) => item.id === payment.targetId && item.status === 'Active');
  return employee ? { total: Number.POSITIVE_INFINITY, direction: 'Paid' } as const : null;
};

export const validateWorkspace = (input: AppData): AppData => {
  const data = recalculateBillStatuses(normalizeWorkspace(input));
  data.settings.currency = 'INR';

  const uniqueChecks: Array<[string, string[]]> = [
    ['supplier code', data.suppliers.map((item) => item.code)],
    ['site code', data.sites.map((item) => item.code)],
    ['material code', data.materials.map((item) => item.code)],
    ['receipt number', data.receipts.map((item) => item.receiptNo)],
    ['issue number', data.supplies.map((item) => item.issueNo)],
    ['bill number', data.bills.map((item) => item.billNo)],
    ['payment number', data.payments.map((item) => item.paymentNo)],
    ['manual voucher number', data.vouchers.map((item) => item.voucherNo)],
    ['employee code', data.employees.map((item) => item.code)],
  ];
  for (const [label, values] of uniqueChecks) {
    const duplicate = duplicateValue(values);
    if (duplicate) throw new Error(`Duplicate ${label}: ${duplicate}`);
  }

  const materialIds = new Set(data.materials.map((item) => item.id));
  const supplierIds = new Set(data.suppliers.map((item) => item.id));
  const siteIds = new Set(data.sites.map((item) => item.id));
  const validateItems = (documentNo: string, items: Array<{ materialId: string; quantity: number; rate: number }>) => {
    if (!items.length) throw new Error(`${documentNo} must contain at least one item.`);
    if (items.some((item) => !materialIds.has(item.materialId) || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.rate) || item.rate < 0)) {
      throw new Error(`${documentNo} contains an invalid material, quantity, or rate.`);
    }
  };
  for (const receipt of data.receipts) {
    if (!supplierIds.has(receipt.supplierId)) throw new Error(`Receipt ${receipt.receiptNo} references an unknown supplier.`);
    if (receipt.destination === 'Direct to Site' && (!receipt.siteId || !siteIds.has(receipt.siteId))) throw new Error(`Receipt ${receipt.receiptNo} requires a valid site.`);
    validateItems(receipt.receiptNo, receipt.items);
  }
  for (const supply of data.supplies) {
    if (!siteIds.has(supply.siteId)) throw new Error(`Issue ${supply.issueNo} references an unknown site.`);
    validateItems(supply.issueNo, supply.items);
  }
  for (const bill of data.bills) {
    validateItems(bill.billNo, bill.items);
    if (bill.supplierId && !supplierIds.has(bill.supplierId)) throw new Error(`Bill ${bill.billNo} references an unknown supplier.`);
    if (bill.siteId && !siteIds.has(bill.siteId)) throw new Error(`Bill ${bill.billNo} references an unknown site.`);
  }

  for (const payment of data.payments) {
    if (!(payment.amount > 0) || !Number.isFinite(payment.amount)) throw new Error(`Payment ${payment.paymentNo} has an invalid amount.`);
    const target = targetForPayment(data, payment);
    if (!target) throw new Error(`Payment ${payment.paymentNo} references an unavailable target.`);
    if (payment.direction !== target.direction) throw new Error(`Payment ${payment.paymentNo} has the wrong direction for its target.`);
    if (Number.isFinite(target.total)) {
      const paid = data.payments.filter((item) => item.category === payment.category && item.targetId === payment.targetId).reduce((sum, item) => sum + item.amount, 0);
      if (paid > target.total + 0.005) throw new Error(`Payments against ${payment.category.toLowerCase()} ${payment.targetId} exceed its total.`);
    }
  }

  for (const voucher of data.vouchers) {
    const totals = voucherTotals(voucher);
    const accountIds = new Set(data.accounts.map((account) => account.id));
    if (!voucher.lines.length || totals.debit <= 0 || Math.abs(totals.debit - totals.credit) > 0.01) throw new Error(`Voucher ${voucher.voucherNo} is not balanced.`);
    if (voucher.sourceType && !['Bill', 'Payment', 'Supply', 'Opening', 'Manual'].includes(voucher.sourceType)) throw new Error(`Voucher ${voucher.voucherNo} has an invalid source.`);
    if (voucher.lines.some((line) => !accountIds.has(line.accountId) || !Number.isFinite(line.debit) || !Number.isFinite(line.credit) || line.debit < 0 || line.credit < 0 || (line.debit > 0) === (line.credit > 0))) throw new Error(`Voucher ${voucher.voucherNo} contains an invalid line.`);
  }

  const employeeIds = new Set(data.employees.map((employee) => employee.id));
  if (data.salaryAdvances.some((advance) => !employeeIds.has(advance.employeeId) || !Number.isFinite(advance.amount) || advance.amount <= 0)) {
    throw new Error('A salary advance has an invalid amount or employee.');
  }

  if (data.settings.strictStockControl) {
    const negative = inventoryRows(data).find((row) => row.availableQty < -0.0005);
    if (negative) throw new Error(`Insufficient stock for ${negative.name}. Available would become ${negative.availableQty} ${negative.unit}.`);
  }
  return data;
};

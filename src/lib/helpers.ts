import type { AppData, Bill, DayAttendance, DeductionDecision, Employee, InventoryRow, Receipt, StockMovement, Supply, TransactionItem, Voucher, VoucherLine } from '../types';

export const uid = (prefix = 'id') => `${prefix}-${crypto.randomUUID()}`;
export const dateInputValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
export const today = () => dateInputValue();
export const currency = (value: number, code = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(value || 0);
export const number = (value: number, digits = 2) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(value || 0);

const WORDS_BELOW_20 = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS_WORDS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const wordsUnderThousand = (value: number): string => {
  const parts: string[] = [];
  if (value >= 100) {
    parts.push(`${WORDS_BELOW_20[Math.floor(value / 100)]} Hundred`);
    value %= 100;
  }
  if (value >= 20) {
    parts.push(TENS_WORDS[Math.floor(value / 10)]);
    value %= 10;
  }
  if (value > 0) parts.push(WORDS_BELOW_20[value]);
  return parts.join(' ');
};

export const amountInIndianWords = (amount: number) => {
  const safeAmount = Math.max(0, Math.round((amount || 0) * 100) / 100);
  let rupees = Math.floor(safeAmount);
  const paise = Math.round((safeAmount - rupees) * 100);
  const parts: string[] = [];
  const groups: Array<[number, string]> = [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand'], [1, '']];
  for (const [divider, label] of groups) {
    const groupValue = Math.floor(rupees / divider);
    if (!groupValue) continue;
    parts.push(`${wordsUnderThousand(groupValue)}${label ? ` ${label}` : ''}`);
    rupees %= divider;
  }
  const rupeeWords = parts.length ? parts.join(' ') : 'Zero';
  return paise ? `${rupeeWords} Rupees and ${wordsUnderThousand(paise)} Paise Only` : `${rupeeWords} Rupees Only`;
};

export const documentNo = (prefix: string, count: number) => `${prefix}-${String(count + 1).padStart(4, '0')}`;
export const nextDocumentNo = (prefix: string, existing: string[]) => {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}-(\\d+)$`, 'i');
  const max = existing.reduce((currentMax, value) => {
    const match = pattern.exec(value.trim());
    return match ? Math.max(currentMax, Number(match[1])) : currentMax;
  }, 0);
  return documentNo(prefix, max);
};

export const itemSubtotal = (item: TransactionItem) => item.quantity * item.rate;
export const itemTax = (item: TransactionItem) => itemSubtotal(item) * ((item.taxRate || 0) / 100);
export const itemsSubtotal = (items: TransactionItem[]) => items.reduce((sum, item) => sum + itemSubtotal(item), 0);
export const itemsTax = (items: TransactionItem[]) => items.reduce((sum, item) => sum + itemTax(item), 0);

/** Document-level GST: taxable amount is the item subtotal; GST is only applied when explicitly enabled. */
export const taxableAmount = (items: TransactionItem[]) => itemsSubtotal(items);
export const gstAmount = (items: TransactionItem[], gstEnabled: boolean, gstRate: number) =>
  gstEnabled ? taxableAmount(items) * ((gstRate || 0) / 100) : 0;

export const billTotal = (bill: Bill) =>
  taxableAmount(bill.items) + gstAmount(bill.items, bill.gstEnabled, bill.gstRate) + bill.otherCharges - bill.discount;
export const supplyTotal = (supply: Supply) =>
  taxableAmount(supply.items) + gstAmount(supply.items, supply.gstEnabled, supply.gstRate);
export const receiptTotal = (receipt: Receipt) => taxableAmount(receipt.items);

export const paidForBill = (data: AppData, billId: string) =>
  data.payments.filter((payment) => payment.category === 'Bill' && payment.targetId === billId).reduce((sum, payment) => sum + payment.amount, 0);
export const billBalance = (data: AppData, bill: Bill) => Math.max(0, billTotal(bill) - paidForBill(data, bill.id));

export const paidForSupply = (data: AppData, supplyId: string) =>
  data.payments.filter((payment) => payment.category === 'Supply' && payment.targetId === supplyId).reduce((sum, payment) => sum + payment.amount, 0);
export const supplyBalance = (data: AppData, supply: Supply) => Math.max(0, supplyTotal(supply) - paidForSupply(data, supply.id));

export const paidForReceipt = (data: AppData, receiptId: string) =>
  data.payments.filter((payment) => payment.category === 'Receipt' && payment.targetId === receiptId).reduce((sum, payment) => sum + payment.amount, 0);
export const receiptBalance = (data: AppData, receipt: Receipt) => Math.max(0, receiptTotal(receipt) - paidForReceipt(data, receipt.id));

export const paidForEmployee = (data: AppData, employeeId: string) =>
  data.payments.filter((payment) => payment.category === 'Employee' && payment.targetId === employeeId).reduce((sum, payment) => sum + payment.amount, 0);

export const itemQuantitiesByMaterial = (items: TransactionItem[]) => items.reduce((map, item) => {
  map.set(item.materialId, (map.get(item.materialId) ?? 0) + item.quantity);
  return map;
}, new Map<string, number>());

export const stockShortage = (items: TransactionItem[], inventory: InventoryRow[]) => {
  const quantities = itemQuantitiesByMaterial(items);
  return [...quantities.entries()].find(([materialId, quantity]) =>
    quantity > (inventory.find((row) => row.id === materialId)?.availableQty ?? 0),
  );
};

export const stockMovements = (data: AppData): StockMovement[] => {
  const rows: StockMovement[] = [];
  data.materials.forEach((material) => rows.push({
    id: `opening-${material.id}`,
    date: data.settings.financialYearStart,
    documentNo: 'OPENING',
    source: 'Opening',
    materialId: material.id,
    inward: material.openingStock,
    outward: 0,
    rate: material.standardRate ?? 0,
    value: material.openingStock * (material.standardRate ?? 0),
    note: material.location ? `Opening stock at ${material.location}` : 'Opening stock',
  }));
  data.receipts.filter((receipt) => receipt.destination === 'Central Store').forEach((receipt) => receipt.items.forEach((item) => rows.push({
    id: `${receipt.id}-${item.id}`,
    date: receipt.date,
    documentNo: receipt.receiptNo,
    source: 'GRN',
    materialId: item.materialId,
    inward: item.quantity,
    outward: 0,
    rate: item.rate,
    value: item.quantity * item.rate,
    note: receipt.invoiceNo ? `Supplier invoice ${receipt.invoiceNo}` : receipt.notes,
  })));
  data.bills.filter((bill) => bill.type === 'Purchase' && bill.inventoryPosting === 'Auto Post').forEach((bill) => bill.items.forEach((item) => rows.push({
    id: `${bill.id}-${item.id}-stock`,
    date: bill.date,
    documentNo: bill.billNo,
    source: 'Purchase Invoice',
    materialId: item.materialId,
    inward: item.quantity,
    outward: 0,
    rate: item.rate,
    value: item.quantity * item.rate,
    note: `Auto-posted from ${bill.partyName}`,
  })));
  data.supplies.forEach((supply) => supply.items.forEach((item) => rows.push({
    id: `${supply.id}-${item.id}`,
    date: supply.date,
    documentNo: supply.issueNo,
    source: 'Issue',
    materialId: item.materialId,
    siteId: supply.siteId,
    inward: 0,
    outward: item.quantity,
    rate: item.rate,
    value: item.quantity * item.rate,
    note: supply.notes,
  })));
  data.bills.filter((bill) => bill.type === 'Client' && bill.inventoryPosting === 'Auto Post').forEach((bill) => bill.items.forEach((item) => rows.push({
    id: `${bill.id}-${item.id}-stock`,
    date: bill.date,
    documentNo: bill.billNo,
    source: 'Client Invoice',
    materialId: item.materialId,
    siteId: bill.siteId,
    inward: 0,
    outward: item.quantity,
    rate: item.rate,
    value: item.quantity * item.rate,
    note: `Auto-posted client invoice for ${bill.partyName}`,
  })));
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.documentNo.localeCompare(b.documentNo));
};

export const inventoryRows = (data: AppData): InventoryRow[] => {
  const movements = stockMovements(data);
  return data.materials.map((material) => {
    const matching = movements.filter((movement) => movement.materialId === material.id);
    const receivedQty = matching.filter((movement) => movement.source === 'GRN').reduce((sum, movement) => sum + movement.inward, 0);
    const purchasedQty = matching.filter((movement) => movement.source === 'Purchase Invoice').reduce((sum, movement) => sum + movement.inward, 0);
    const suppliedQty = matching.filter((movement) => movement.source === 'Issue').reduce((sum, movement) => sum + movement.outward, 0);
    const soldQty = matching.filter((movement) => movement.source === 'Client Invoice').reduce((sum, movement) => sum + movement.outward, 0);
    const availableQty = matching.reduce((sum, movement) => sum + movement.inward - movement.outward, 0);
    return { ...material, receivedQty, purchasedQty, suppliedQty, soldQty, availableQty, stockValue: availableQty * (material.standardRate ?? 0) };
  });
};

const line = (accountId: string, debit = 0, credit = 0, narration = ''): VoucherLine => ({ id: uid('vl'), accountId, debit, credit, narration });
const cleanLines = (lines: VoucherLine[]) => lines.filter((entry) => Math.abs(entry.debit) > 0.0001 || Math.abs(entry.credit) > 0.0001);

export const allVouchers = (data: AppData): Voucher[] => {
  const vouchers: Voucher[] = [];
  const openingLines: VoucherLine[] = [];
  data.accounts.forEach((account) => {
    if (!account.openingBalance || account.id === 'acc-equity') return;
    if (account.category === 'Asset' || account.category === 'Expense') openingLines.push(line(account.id, account.openingBalance, 0, 'Ledger opening balance'));
    else openingLines.push(line(account.id, 0, account.openingBalance, 'Ledger opening balance'));
  });
  const materialOpening = data.materials.reduce((sum, material) => sum + material.openingStock * (material.standardRate ?? 0), 0);
  const supplierOpening = data.suppliers.reduce((sum, supplier) => sum + supplier.openingBalance, 0);
  if (materialOpening) openingLines.push(line('acc-inventory', materialOpening, 0, 'Material opening stock'));
  if (supplierOpening) openingLines.push(line('acc-payable', 0, supplierOpening, 'Supplier opening balances'));
  const openingDebit = openingLines.reduce((sum, entry) => sum + entry.debit, 0);
  const openingCredit = openingLines.reduce((sum, entry) => sum + entry.credit, 0);
  if (openingDebit > openingCredit) openingLines.push(line('acc-equity', 0, openingDebit - openingCredit, 'Opening balance difference'));
  if (openingCredit > openingDebit) openingLines.push(line('acc-equity', openingCredit - openingDebit, 0, 'Opening balance difference'));
  if (openingLines.length) vouchers.push({ id: 'auto-opening', voucherNo: 'OPENING', type: 'Opening', date: data.settings.financialYearStart, partyName: data.settings.companyName, reference: '', narration: 'Opening balances', lines: cleanLines(openingLines), sourceType: 'Opening', createdAt: data.settings.financialYearStart });

  data.bills.forEach((bill) => {
    const subtotal = itemsSubtotal(bill.items);
    const tax = gstAmount(bill.items, bill.gstEnabled, bill.gstRate);
    const total = billTotal(bill);
    const lines: VoucherLine[] = [];
    if (bill.type === 'Purchase') {
      lines.push(line(bill.inventoryPosting === 'Auto Post' ? 'acc-inventory' : 'acc-purchases', subtotal, 0, 'Purchase value'));
      lines.push(line('acc-input-gst', tax, 0, 'Input GST'));
      lines.push(line('acc-other-charges', bill.otherCharges, 0, 'Freight and charges'));
      lines.push(line('acc-payable', 0, total, bill.partyName));
      lines.push(line('acc-discount-received', 0, bill.discount, 'Purchase discount'));
    } else {
      lines.push(line('acc-receivable', total, 0, bill.partyName));
      lines.push(line('acc-discount-allowed', bill.discount, 0, 'Sales discount'));
      lines.push(line('acc-sales', 0, subtotal, 'Construction/material revenue'));
      lines.push(line('acc-output-gst', 0, tax, 'Output GST'));
      lines.push(line('acc-other-income', 0, bill.otherCharges, 'Other billed charges'));
      if (bill.inventoryPosting === 'Auto Post') {
        const cost = bill.items.reduce((sum, item) => {
          const material = data.materials.find((candidate) => candidate.id === item.materialId);
          return sum + item.quantity * (material?.standardRate ?? item.rate);
        }, 0);
        lines.push(line('acc-site-expense', cost, 0, 'Cost of materials sold'));
        lines.push(line('acc-inventory', 0, cost, 'Inventory issued through invoice'));
      }
    }
    vouchers.push({ id: `auto-${bill.id}`, voucherNo: bill.billNo, type: bill.type === 'Purchase' ? 'Debit Note' : 'Credit Note', date: bill.date, partyName: bill.partyName, reference: bill.referenceNo ?? '', narration: bill.notes || `${bill.type} invoice posting`, lines: cleanLines(lines), sourceType: 'Bill', sourceId: bill.id, createdAt: bill.createdAt });
  });

  data.supplies.forEach((supply) => {
    const value = supply.items.reduce((sum, item) => {
      const material = data.materials.find((candidate) => candidate.id === item.materialId);
      return sum + item.quantity * (material?.standardRate ?? item.rate);
    }, 0);
    if (!value) return;
    const site = data.sites.find((candidate) => candidate.id === supply.siteId);
    vouchers.push({ id: `auto-${supply.id}`, voucherNo: supply.issueNo, type: 'Journal', date: supply.date, partyName: site?.name ?? '', reference: supply.issueNo, narration: supply.notes || 'Material issued to site', lines: [line('acc-site-expense', value, 0, 'Site consumption'), line('acc-inventory', 0, value, 'Inventory issued')], sourceType: 'Manual', sourceId: supply.id, createdAt: supply.createdAt });
  });

  data.payments.forEach((payment) => {
    const cashAccount = payment.mode === 'Cash' ? 'acc-cash' : 'acc-bank';
    const counterAccount = payment.category === 'Employee' ? 'acc-wages-expense'
      : payment.category === 'Receipt' ? 'acc-payable'
      : payment.category === 'Supply' ? 'acc-receivable'
      : payment.direction === 'Paid' ? 'acc-payable' : 'acc-receivable';
    const lines = payment.category === 'Employee'
      ? [line(counterAccount, payment.amount, 0, payment.partyName), line(cashAccount, 0, payment.amount, payment.mode)]
      : payment.direction === 'Paid'
        ? [line(counterAccount, payment.amount, 0, payment.partyName), line(cashAccount, 0, payment.amount, payment.mode)]
        : [line(cashAccount, payment.amount, 0, payment.mode), line(counterAccount, 0, payment.amount, payment.partyName)];
    vouchers.push({ id: `auto-${payment.id}`, voucherNo: payment.paymentNo, type: payment.category === 'Employee' ? 'Payment' : payment.direction === 'Paid' ? 'Payment' : 'Receipt', date: payment.date, partyName: payment.partyName, reference: payment.reference, narration: payment.notes || `${payment.category} payment`, lines, sourceType: 'Payment', sourceId: payment.id, createdAt: payment.createdAt });
  });

  return [...vouchers, ...data.vouchers].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
};

export const voucherTotals = (voucher: Voucher) => ({
  debit: voucher.lines.reduce((sum, entry) => sum + entry.debit, 0),
  credit: voucher.lines.reduce((sum, entry) => sum + entry.credit, 0),
});

export const accountActivity = (data: AppData, accountId: string) => allVouchers(data).flatMap((voucher) =>
  voucher.lines.filter((entry) => entry.accountId === accountId).map((entry) => ({ voucher, ...entry })),
).sort((a, b) => a.voucher.date.localeCompare(b.voucher.date) || a.voucher.voucherNo.localeCompare(b.voucher.voucherNo));

export const accountBalances = (data: AppData) => data.accounts.map((account) => {
  const activity = accountActivity(data, account.id);
  const debit = activity.reduce((sum, entry) => sum + entry.debit, 0);
  const credit = activity.reduce((sum, entry) => sum + entry.credit, 0);
  return { ...account, debit, credit, net: debit - credit };
});

export const downloadCsv = (filename: string, rows: Record<string, unknown>[]) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((row) => headers.map((key) => escape(row[key])).join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace(/\.xlsx$/i, '.csv');
  link.click();
  URL.revokeObjectURL(url);
};


// ── Staff attendance & payroll ─────────────────────────────────────────────
export const attendanceKey = (employeeId: string, year: number, month: number, day: number) => `${employeeId}_${year}_${month}_${day}`;

export const defaultDayAttendance = (): DayAttendance => ({ present: false, half: false, woff: false, absent: false });

export const defaultDeductionDecision = (): DeductionDecision => ({ deductAdvance: false, deductOther: true });

export const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate();

export const monthLabel = (year: number, month: number) => new Date(year, month - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

export interface MonthAttendanceSummary {
  presentDays: number;
  halfDays: number;
  weekOffs: number;
  absentDays: number;
  workingDays: number;
  payableDays: number;
}

export const summarizeAttendance = (data: AppData, employeeId: string, year: number, month: number): MonthAttendanceSummary => {
  const total = daysInMonth(year, month);
  let presentDays = 0, halfDays = 0, weekOffs = 0, absentDays = 0;
  for (let day = 1; day <= total; day++) {
    const entry = data.attendance[attendanceKey(employeeId, year, month, day)];
    if (!entry) continue;
    if (entry.woff) weekOffs++;
    else if (entry.half) halfDays++;
    else if (entry.present) presentDays++;
    else if (entry.absent) absentDays++;
  }
  const workingDays = presentDays + halfDays + weekOffs + absentDays;
  const payableDays = presentDays + halfDays * 0.5;
  return { presentDays, halfDays, weekOffs, absentDays, workingDays, payableDays };
};

export interface EmployeeSalaryBreakdown {
  perDay: number;
  earned: number;
  advanceDeduction: number;
  otherDeduction: number;
  totalDeductions: number;
  net: number;
}

export const calcEmployeeSalary = (data: AppData, employee: Employee, year: number, month: number, decision: DeductionDecision): EmployeeSalaryBreakdown => {
  const total = daysInMonth(year, month);
  const attendance = summarizeAttendance(data, employee.id, year, month);
  const perDay = employee.grossSalary / total;
  const earned = Math.round(perDay * attendance.payableDays);
  const outstandingAdvance = data.salaryAdvances.filter((advance) => advance.employeeId === employee.id && !advance.cleared).reduce((sum, advance) => sum + advance.amount, 0);
  const advanceDeduction = decision.deductAdvance ? Math.min(outstandingAdvance, earned) : 0;
  const otherDeduction = decision.deductOther ? employee.otherDeduction : 0;
  const totalDeductions = advanceDeduction + otherDeduction;
  return { perDay, earned, advanceDeduction, otherDeduction, totalDeductions, net: Math.max(0, earned - totalDeductions) };
};

export const outstandingAdvanceFor = (data: AppData, employeeId: string) =>
  data.salaryAdvances.filter((advance) => advance.employeeId === employeeId && !advance.cleared).reduce((sum, advance) => sum + advance.amount, 0);

// ── Analytics ────────────────────────────────────────────────────────────
export interface DepartmentAnalytics {
  department: string;
  employees: number;
  gross: number;
  net: number;
  presentDays: number;
  absentDays: number;
}

export const departmentAnalytics = (data: AppData, employees: Employee[], year: number, month: number): DepartmentAnalytics[] => {
  const map = new Map<string, DepartmentAnalytics>();
  employees.forEach((employee) => {
    const key = employee.department || 'Unassigned';
    const current = map.get(key) ?? { department: key, employees: 0, gross: 0, net: 0, presentDays: 0, absentDays: 0 };
    const attendance = summarizeAttendance(data, employee.id, year, month);
    const breakdown = calcEmployeeSalary(data, employee, year, month, data.deductionDecisions[employee.id] ?? defaultDeductionDecision());
    current.employees += 1;
    current.gross += employee.grossSalary;
    current.net += breakdown.net;
    current.presentDays += attendance.presentDays;
    current.absentDays += attendance.absentDays;
    map.set(key, current);
  });
  return [...map.values()];
};

export const branchAnalytics = (data: AppData, employees: Employee[]) => {
  const map = new Map<string, { branch: string; employees: number; gross: number }>();
  employees.forEach((employee) => {
    const current = map.get(employee.branch) ?? { branch: employee.branch, employees: 0, gross: 0 };
    current.employees += 1;
    current.gross += employee.grossSalary;
    map.set(employee.branch, current);
  });
  return [...map.values()];
};

export const attendanceMixFor = (data: AppData, employees: Employee[], year: number, month: number) => employees.reduce((acc, employee) => {
  const s = summarizeAttendance(data, employee.id, year, month);
  return { present: acc.present + s.presentDays, half: acc.half + s.halfDays, weekOff: acc.weekOff + s.weekOffs, absent: acc.absent + s.absentDays };
}, { present: 0, half: 0, weekOff: 0, absent: 0 });

// ── Weekly payroll (Mesthri, Electrician, Tile Worker, Painter, and Labor opting for weekly pay) ──
export interface DateParts { year: number; month: number; day: number; }

export const toDateParts = (date: Date): DateParts => ({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() });

/** Returns the Monday on or before the given ISO date string. */
export const startOfWeek = (isoDate: string): Date => {
  const date = isoDate ? new Date(`${isoDate}T00:00:00`) : new Date();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
};

export const weekDateParts = (weekStartIso: string): DateParts[] => {
  const start = startOfWeek(weekStartIso);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toDateParts(date);
  });
};

export const weekLabel = (weekStartIso: string) => {
  const parts = weekDateParts(weekStartIso);
  const first = parts[0];
  const last = parts[6];
  const format = (part: DateParts) => new Date(part.year, part.month - 1, part.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return `${format(first)} – ${format(last)}, ${last.year}`;
};

export const summarizeAttendanceForDates = (data: AppData, employeeId: string, dates: DateParts[]): MonthAttendanceSummary => {
  let presentDays = 0, halfDays = 0, weekOffs = 0, absentDays = 0;
  dates.forEach((part) => {
    const entry = data.attendance[attendanceKey(employeeId, part.year, part.month, part.day)];
    if (!entry) return;
    if (entry.woff) weekOffs++;
    else if (entry.half) halfDays++;
    else if (entry.present) presentDays++;
    else if (entry.absent) absentDays++;
  });
  const workingDays = presentDays + halfDays + weekOffs + absentDays;
  const payableDays = presentDays + halfDays * 0.5;
  return { presentDays, halfDays, weekOffs, absentDays, workingDays, payableDays };
};

export const calcEmployeeSalaryForDates = (data: AppData, employee: Employee, dates: DateParts[], decision: DeductionDecision): EmployeeSalaryBreakdown => {
  const attendance = summarizeAttendanceForDates(data, employee.id, dates);
  const perDay = employee.grossSalary / dates.length;
  const earned = Math.round(perDay * attendance.payableDays);
  const outstandingAdvance = data.salaryAdvances.filter((advance) => advance.employeeId === employee.id && !advance.cleared).reduce((sum, advance) => sum + advance.amount, 0);
  const advanceDeduction = decision.deductAdvance ? Math.min(outstandingAdvance, earned) : 0;
  const otherDeduction = decision.deductOther ? employee.otherDeduction : 0;
  const totalDeductions = advanceDeduction + otherDeduction;
  return { perDay, earned, advanceDeduction, otherDeduction, totalDeductions, net: Math.max(0, earned - totalDeductions) };
};

export const isWeeklyOnlyBranch = (branch: Employee['branch']) => branch === 'Mesthri' || branch === 'Electrician' || branch === 'Tile Worker' || branch === 'Painter';

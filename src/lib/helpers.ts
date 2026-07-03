import type { AppData, Bill, InventoryRow, StockMovement, TransactionItem, Voucher, VoucherLine } from '../types';

export const uid = (prefix = 'id') => `${prefix}-${crypto.randomUUID()}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const currency = (value: number, code = 'INR') =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(value || 0);
export const number = (value: number, digits = 2) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(value || 0);
export const documentNo = (prefix: string, count: number) => `${prefix}-${String(count + 1).padStart(4, '0')}`;

export const itemSubtotal = (item: TransactionItem) => item.quantity * item.rate;
export const itemTax = (item: TransactionItem) => itemSubtotal(item) * (item.taxRate / 100);
export const itemsSubtotal = (items: TransactionItem[]) => items.reduce((sum, item) => sum + itemSubtotal(item), 0);
export const itemsTax = (items: TransactionItem[]) => items.reduce((sum, item) => sum + itemTax(item), 0);
export const billTotal = (bill: Bill) => itemsSubtotal(bill.items) + itemsTax(bill.items) + bill.otherCharges - bill.discount;
export const paidForBill = (data: AppData, billId: string) =>
  data.payments.filter((payment) => payment.billId === billId).reduce((sum, payment) => sum + payment.amount, 0);
export const billBalance = (data: AppData, bill: Bill) => Math.max(0, billTotal(bill) - paidForBill(data, bill.id));

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
    rate: material.standardRate,
    value: material.openingStock * material.standardRate,
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
    return { ...material, receivedQty, purchasedQty, suppliedQty, soldQty, availableQty, stockValue: availableQty * material.standardRate };
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
  const materialOpening = data.materials.reduce((sum, material) => sum + material.openingStock * material.standardRate, 0);
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
    const tax = itemsTax(bill.items);
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
    vouchers.push({ id: `auto-${bill.id}`, voucherNo: bill.billNo, type: bill.type === 'Purchase' ? 'Debit Note' : 'Credit Note', date: bill.date, partyName: bill.partyName, reference: bill.referenceNo, narration: bill.notes || `${bill.type} invoice posting`, lines: cleanLines(lines), sourceType: 'Bill', sourceId: bill.id, createdAt: bill.createdAt });
  });

  data.supplies.forEach((supply) => {
    const value = supply.items.reduce((sum, item) => {
      const material = data.materials.find((candidate) => candidate.id === item.materialId);
      return sum + item.quantity * (material?.standardRate ?? item.rate);
    }, 0);
    if (!value) return;
    const site = data.sites.find((candidate) => candidate.id === supply.siteId);
    vouchers.push({ id: `auto-${supply.id}`, voucherNo: supply.issueNo, type: 'Journal', date: supply.date, partyName: site?.name ?? '', reference: supply.vehicleNo, narration: supply.notes || 'Material issued to site', lines: [line('acc-site-expense', value, 0, 'Site consumption'), line('acc-inventory', 0, value, 'Inventory issued')], sourceType: 'Manual', sourceId: supply.id, createdAt: supply.createdAt });
  });

  data.payments.forEach((payment) => {
    const cashAccount = payment.mode === 'Cash' ? 'acc-cash' : 'acc-bank';
    const lines = payment.direction === 'Paid'
      ? [line('acc-payable', payment.amount, 0, payment.partyName), line(cashAccount, 0, payment.amount, payment.mode)]
      : [line(cashAccount, payment.amount, 0, payment.mode), line('acc-receivable', 0, payment.amount, payment.partyName)];
    vouchers.push({ id: `auto-${payment.id}`, voucherNo: payment.paymentNo, type: payment.direction === 'Paid' ? 'Payment' : 'Receipt', date: payment.date, partyName: payment.partyName, reference: payment.reference, narration: payment.notes, lines, sourceType: 'Payment', sourceId: payment.id, createdAt: payment.createdAt });
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
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

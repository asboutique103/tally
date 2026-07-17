import { describe, expect, it } from 'vitest';
import { seedData } from '../data/seed';
import type { AppData, Bill, Material, Payment, Receipt, Site, Supply, Voucher } from '../types';
import { accountBalances, allVouchers, csvCell, voucherTotals } from './helpers';
import { validateWorkspace } from './workspace';

const now = '2026-07-17T00:00:00.000Z';
const material: Material = { id: 'm1', code: 'MAT-1', name: 'Cement', category: 'Cement', unit: 'Bag', standardRate: 400, openingStock: 5, createdAt: now };
const site: Site = { id: 's1', code: 'SITE-1', name: 'Site One', clientName: 'Client', location: 'Chennai', phone: '9876543210', startDate: '2026-04-01', expectedEndDate: '2027-03-31', status: 'Active', createdAt: now };
const item = { id: 'i1', materialId: material.id, quantity: 2, rate: 500, taxRate: 18 };
const bill: Bill = { id: 'b1', billNo: 'INV-1', type: 'Client', date: '2026-07-01', dueDate: '2026-07-31', siteId: site.id, partyName: 'Client', items: [item], discount: 0, otherCharges: 0, gstEnabled: true, gstRate: 18, notes: '', status: 'Unpaid', inventoryPosting: 'Accounting Only', createdAt: now };

const workspace = (): AppData => ({
  ...structuredClone(seedData),
  materials: [material],
  sites: [site],
  bills: [bill],
});

describe('workspace integrity', () => {
  it('rejects stock movements that would make inventory negative', () => {
    const data = workspace();
    const supply: Supply = { id: 'is1', issueNo: 'ISS-1', date: '2026-07-02', siteId: site.id, items: [{ ...item, quantity: 6 }], notes: '', gstEnabled: false, gstRate: 0, createdAt: now };
    data.supplies = [supply];
    expect(() => validateWorkspace(data)).toThrow(/Insufficient stock/);
  });

  it('rejects a payment with the wrong direction and an overpayment', () => {
    const wrongDirection = workspace();
    const payment: Payment = { id: 'p1', paymentNo: 'PAY-1', date: '2026-07-02', category: 'Bill', targetId: bill.id, partyName: 'Client', direction: 'Paid', amount: 100, mode: 'Cash', reference: '', notes: '', createdAt: now };
    wrongDirection.payments = [payment];
    expect(() => validateWorkspace(wrongDirection)).toThrow(/wrong direction/);

    const overpaid = workspace();
    overpaid.payments = [{ ...payment, direction: 'Received', amount: 1181 }];
    expect(() => validateWorkspace(overpaid)).toThrow(/exceed/);
  });

  it('rejects deletion of a referenced master record', () => {
    const data = workspace();
    const receipt: Receipt = { id: 'r1', receiptNo: 'GRN-1', date: '2026-07-01', supplierId: 'missing', invoiceNo: '', vehicleNo: '', destination: 'Central Store', items: [item], notes: '', createdAt: now };
    data.receipts = [receipt];
    expect(() => validateWorkspace(data)).toThrow(/unknown supplier/);
  });
});

describe('accounting and exports', () => {
  it('uses balanced database vouchers without generating duplicates', () => {
    const data = workspace();
    data.vouchers = [{
      id: 'db-bill-b1', voucherNo: bill.billNo, type: 'Credit Note', date: bill.date,
      partyName: bill.partyName, reference: '', narration: '', sourceType: 'Bill', sourceId: bill.id, createdAt: now,
      lines: [
        { id: 'vl1', accountId: 'acc-receivable', debit: 1180, credit: 0 },
        { id: 'vl2', accountId: 'acc-sales', debit: 0, credit: 1180 },
      ],
    }];
    const vouchers = allVouchers(validateWorkspace(data));
    expect(vouchers.filter((voucher) => voucher.sourceType === 'Bill')).toHaveLength(1);
    expect(vouchers.some((voucher) => voucher.id === 'db-bill-b1')).toBe(true);
    vouchers.forEach((voucher) => {
      const totals = voucherTotals(voucher);
      expect(totals.debit).toBeCloseTo(totals.credit, 2);
    });
  });

  it('scopes account balances to the requested financial period', () => {
    const data = workspace();
    const manual: Voucher = { id: 'v1', voucherNo: 'OLD-1', type: 'Journal', date: '2025-01-01', partyName: '', reference: '', narration: '', sourceType: 'Manual', createdAt: now, lines: [
      { id: 'l1', accountId: 'acc-cash', debit: 100, credit: 0 },
      { id: 'l2', accountId: 'acc-equity', debit: 0, credit: 100 },
    ] };
    data.vouchers = [manual];
    const cash = accountBalances(validateWorkspace(data), '2026-04-01', '2027-03-31').find((account) => account.id === 'acc-cash');
    expect(cash?.debit).toBe(0);
  });

  it('neutralizes spreadsheet formulas in CSV cells', () => {
    expect(csvCell('=2+2')).toBe("'=2+2");
    expect(csvCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    expect(csvCell('safe')).toBe('safe');
  });
});

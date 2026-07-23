import { describe, expect, it } from 'vitest';
import type { Bill } from '../types';
import { directCustomerPhone, directCustomerReference, isDirectCustomerBill } from './directCustomers';

const bill = (referenceNo?: string): Bill => ({
  id: 'bill-1',
  billNo: 'DC-0001',
  type: 'Client',
  date: '2026-07-23',
  dueDate: '2026-07-23',
  partyName: 'Store Customer',
  partyAddress: 'Hosur',
  referenceNo,
  items: [{ id: 'item-1', materialId: 'material-1', quantity: 1, rate: 100, taxRate: 0 }],
  discount: 0,
  otherCharges: 0,
  gstEnabled: false,
  gstRate: 0,
  status: 'Unpaid',
  inventoryPosting: 'Accounting Only',
  notes: '',
  createdAt: '2026-07-23T00:00:00.000Z',
});

describe('direct customer invoice classification', () => {
  it('stores a normalized phone and identifies direct customer invoices', () => {
    const direct = bill(directCustomerReference('+91 98765-43210'));
    expect(isDirectCustomerBill(direct)).toBe(true);
    expect(directCustomerPhone(direct)).toBe('919876543210');
  });

  it('does not classify ordinary project client invoices as direct customers', () => {
    expect(isDirectCustomerBill(bill('CLIENT-PO-10'))).toBe(false);
    expect(directCustomerPhone(bill('CLIENT-PO-10'))).toBe('');
  });
});

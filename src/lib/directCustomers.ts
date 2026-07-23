import type { Bill } from '../types';

export const DIRECT_CUSTOMER_PREFIX = 'DIRECT_CUSTOMER|';

export const isDirectCustomerBill = (bill: Bill) => (
  bill.type === 'Client' && (bill.referenceNo ?? '').startsWith(DIRECT_CUSTOMER_PREFIX)
);

export const directCustomerPhone = (bill: Bill) => (
  isDirectCustomerBill(bill)
    ? (bill.referenceNo ?? '').slice(DIRECT_CUSTOMER_PREFIX.length)
    : ''
);

export const directCustomerReference = (phone: string) => (
  `${DIRECT_CUSTOMER_PREFIX}${phone.replace(/\D/g, '')}`
);

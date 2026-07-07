import type { TransactionItem } from '../types';

export const cleanText = (value?: string | null) => (value ?? '').trim();

export const isFilled = (value?: string | null) => cleanText(value).length > 0;

export const isPositive = (value: number) => Number.isFinite(value) && value > 0;

export const isZeroOrPositive = (value: number) => Number.isFinite(value) && value >= 0;

export const isSameOrAfter = (value: string, compareTo: string) => !value || !compareTo || value >= compareTo;

export const compactPhone = (value: string) => value.replace(/\D/g, '').slice(-10);

export const isValidIndianPhone = (value: string) => /^[6-9]\d{9}$/.test(compactPhone(value));

export const normalizeGstin = (value: string) => cleanText(value).toUpperCase();

export const isValidGstin = (value: string, allowUnregistered = false) => {
  const gstin = normalizeGstin(value);
  if (allowUnregistered && gstin === 'URP') return true;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin);
};

export const isValidHsn = (value?: string | null) => /^\d{4,8}$/.test(cleanText(value));

export const hasValidItems = (items: TransactionItem[]) =>
  items.length > 0 && items.every((item) =>
    isFilled(item.materialId) &&
    isPositive(item.quantity) &&
    isPositive(item.rate) &&
    isZeroOrPositive(item.taxRate),
  );

export const hasDuplicate = <T extends { id: string }>(items: T[], currentId: string, predicate: (item: T) => boolean) =>
  items.some((item) => item.id !== currentId && predicate(item));

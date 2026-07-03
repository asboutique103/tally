import { seedData } from '../data/seed';
import type { AppData } from '../types';

const STORAGE_KEY = 'constructflow-ledger-v2';
const LEGACY_KEY = 'constructflow-ledger-v1';

const migrateData = (input: Partial<AppData>): AppData => {
  const bills = (input.bills ?? seedData.bills).map((bill) => ({
    ...bill,
    inventoryPosting: bill.inventoryPosting ?? 'Accounting Only',
  }));
  return {
    suppliers: input.suppliers ?? structuredClone(seedData.suppliers),
    sites: input.sites ?? structuredClone(seedData.sites),
    materials: input.materials ?? structuredClone(seedData.materials),
    receipts: input.receipts ?? structuredClone(seedData.receipts),
    supplies: input.supplies ?? structuredClone(seedData.supplies),
    bills,
    payments: input.payments ?? structuredClone(seedData.payments),
    accounts: input.accounts?.length ? input.accounts : structuredClone(seedData.accounts),
    vouchers: input.vouchers ?? [],
    auditLog: input.auditLog ?? structuredClone(seedData.auditLog),
    settings: {
      ...seedData.settings,
      ...(input.settings ?? {}),
    },
  };
};

export const loadLocalData = (): AppData => {
  const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
  if (!raw) {
    const initial = structuredClone(seedData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    const migrated = migrateData(JSON.parse(raw) as Partial<AppData>);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    const initial = structuredClone(seedData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
};

export const saveLocalData = (data: AppData) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

export const resetLocalData = () => {
  const initial = structuredClone(seedData);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

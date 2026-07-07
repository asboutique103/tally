import { seedData } from '../data/seed';
import { isSupabaseConfigured, supabase } from './supabase';
import type { AppData } from '../types';

const STORAGE_KEY = 'constructflow-ledger-v4';
const DEPRECATED_KEYS = ['constructflow-ledger-v3', 'constructflow-ledger-v2', 'constructflow-ledger-v1'];
const CLOUD_WORKSPACE_KEY = 'default';

const blankWorkspace = () => structuredClone(seedData);

const containsRemovedDemoData = (input: Partial<AppData>) => {
  const suppliers = input.suppliers ?? [];
  const employees = input.employees ?? [];
  const materials = input.materials ?? [];

  return input.settings?.companyName === 'VMV ENTERPRISES'
    || suppliers.some((supplier) => ['sup-1', 'sup-2', 'sup-3'].includes(supplier.id))
    || employees.some((employee) => ['emp-1', 'emp-2', 'emp-3'].includes(employee.id))
    || materials.some((material) => ['mat-1', 'mat-2', 'mat-3', 'mat-4', 'mat-5'].includes(material.id));
};

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
    employees: input.employees ?? structuredClone(seedData.employees),
    attendance: input.attendance ?? {},
    salaryAdvances: input.salaryAdvances ?? [],
    deductionDecisions: input.deductionDecisions ?? {},
    auditLog: input.auditLog ?? structuredClone(seedData.auditLog),
    settings: {
      ...seedData.settings,
      ...(input.settings ?? {}),
    },
  };
};

export const loadLocalData = (): AppData => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    DEPRECATED_KEYS.forEach((key) => localStorage.removeItem(key));
    const initial = blankWorkspace();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AppData>;
    if (containsRemovedDemoData(parsed)) {
      const initial = blankWorkspace();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const migrated = migrateData(parsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    const initial = blankWorkspace();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
};

export const saveLocalData = (data: AppData) => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

export const resetLocalData = () => {
  const initial = blankWorkspace();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  return initial;
};

const activeSupabaseUserId = async () => {
  if (!isSupabaseConfigured || !supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
};

export const loadPersistedData = async (): Promise<AppData> => {
  const localData = loadLocalData();
  if (!isSupabaseConfigured || !supabase) return localData;

  const userId = await activeSupabaseUserId();
  if (!userId) return localData;

  const { data, error } = await supabase
    .from('app_state')
    .select('data')
    .eq('workspace_key', CLOUD_WORKSPACE_KEY)
    .maybeSingle();

  if (error) {
    console.error('Unable to load Supabase app state', error.message);
    return localData;
  }

  if (data?.data) {
    const remoteData = data.data as Partial<AppData>;
    if (containsRemovedDemoData(remoteData)) {
      const initial = blankWorkspace();
      await savePersistedData(initial);
      return initial;
    }
    const migrated = migrateData(remoteData);
    saveLocalData(migrated);
    return migrated;
  }

  await savePersistedData(localData);
  return localData;
};

export const savePersistedData = async (data: AppData) => {
  const persistedData = containsRemovedDemoData(data) ? blankWorkspace() : data;
  saveLocalData(persistedData);
  if (!isSupabaseConfigured || !supabase) return;

  const userId = await activeSupabaseUserId();
  if (!userId) return;

  const { error } = await supabase
    .from('app_state')
    .upsert(
      {
        owner_id: userId,
        workspace_key: CLOUD_WORKSPACE_KEY,
        data: persistedData,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id,workspace_key' },
    );

  if (error) {
    console.error('Unable to save Supabase app state', error.message);
  }
};

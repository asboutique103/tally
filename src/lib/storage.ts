import { seedData } from '../data/seed';
import { isSupabaseConfigured, supabase } from './supabase';
import type { AppData } from '../types';

const STORAGE_KEY = 'constructflow-ledger-v4';
const DEPRECATED_KEYS = ['constructflow-ledger-v3', 'constructflow-ledger-v2', 'constructflow-ledger-v1'];
const CLOUD_WORKSPACE_KEY = 'default';

interface AppStateRpcResult {
  ok: boolean;
  data?: Partial<AppData> | null;
  version?: number | null;
  message?: string | null;
}

export interface LoadPersistedResult {
  data: AppData;
  version: number | null;
}

export interface SavePersistedResult {
  ok: boolean;
  version: number | null;
  message?: string;
}

const blankWorkspace = () => structuredClone(seedData);

const firstResult = (value: unknown) => (Array.isArray(value) ? value[0] : value) as AppStateRpcResult | undefined;

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

export const loadPersistedData = async (sessionToken?: string | null): Promise<LoadPersistedResult> => {
  const localData = loadLocalData();
  if (!isSupabaseConfigured || !supabase) return { data: localData, version: null };
  if (!sessionToken) throw new Error('Missing Supabase app session.');

  const { data, error } = await supabase.rpc('get_app_state', {
    p_session_token: sessionToken,
    p_workspace_key: CLOUD_WORKSPACE_KEY,
  });
  if (error) throw new Error(error.message);

  const result = firstResult(data);
  if (!result?.ok) throw new Error(result?.message ?? 'Unable to load Supabase app state.');

  if (result.data) {
    const remoteData = containsRemovedDemoData(result.data) ? blankWorkspace() : migrateData(result.data);
    saveLocalData(remoteData);
    return { data: remoteData, version: result.version ?? null };
  }

  const saved = await savePersistedData(localData, sessionToken, null);
  return { data: localData, version: saved.version };
};

export const savePersistedData = async (data: AppData, sessionToken?: string | null, expectedVersion?: number | null): Promise<SavePersistedResult> => {
  const persistedData = containsRemovedDemoData(data) ? blankWorkspace() : data;
  saveLocalData(persistedData);
  if (!isSupabaseConfigured || !supabase) return { ok: true, version: null };
  if (!sessionToken) throw new Error('Missing Supabase app session.');

  const { data: rpcData, error } = await supabase.rpc('save_app_state', {
    p_session_token: sessionToken,
    p_workspace_key: CLOUD_WORKSPACE_KEY,
    p_data: persistedData,
    p_expected_version: expectedVersion,
  });
  if (error) throw new Error(error.message);

  const result = firstResult(rpcData);
  if (!result?.ok) {
    return { ok: false, version: result?.version ?? expectedVersion ?? null, message: result?.message ?? 'Cloud workspace changed before this save.' };
  }
  return { ok: true, version: result.version ?? null };
};

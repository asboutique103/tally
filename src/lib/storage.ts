import { seedData } from '../data/seed';
import { isSupabaseConfigured, supabase } from './supabase';
import type { AppData } from '../types';

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

/**
 * Supabase is the single source of truth for app data. Nothing is cached in
 * localStorage: every read goes to the database, and every write is pushed
 * there immediately. If Supabase isn't configured (e.g. local dev without
 * env vars), the app falls back to an in-memory-only blank workspace that is
 * never persisted anywhere.
 */
export const loadPersistedData = async (sessionToken?: string | null): Promise<LoadPersistedResult> => {
  if (!isSupabaseConfigured || !supabase) return { data: blankWorkspace(), version: null };
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
    return { data: remoteData, version: result.version ?? null };
  }

  const blank = blankWorkspace();
  const saved = await savePersistedData(blank, sessionToken, null);
  if (!saved.ok) throw new Error(saved.message ?? 'Unable to initialize Supabase workspace.');
  return { data: blank, version: saved.version };
};

export const savePersistedData = async (data: AppData, sessionToken?: string | null, expectedVersion?: number | null): Promise<SavePersistedResult> => {
  const persistedData = containsRemovedDemoData(data) ? blankWorkspace() : data;
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

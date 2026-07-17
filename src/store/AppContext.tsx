import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as db from '../lib/storage';
import { seedData } from '../data/seed';
import { attendanceKey, defaultDeductionDecision } from '../lib/helpers';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  appendAudit, loadLocalWorkspace, normalizeWorkspace, saveLocalWorkspace,
  validateWorkspace, type WorkspaceAudit,
} from '../lib/workspace';
import { useAuth } from './AuthContext';
import type {
  AppData, AppSettings, Bill, DayAttendance, DeductionDecision, Employee, Material,
  Payment, Receipt, SalaryAdvance, Site, Supplier, Supply, Voucher,
} from '../types';

type Mutation = (current: AppData) => AppData;
type AsyncAction = Promise<void>;
type RemoteAction = (token: string) => Promise<unknown>;

interface AppContextValue {
  data: AppData;
  cloudLoaded: boolean;
  saving: boolean;
  syncError: string | null;
  dismissSyncError: () => void;
  upsertSupplier: (supplier: Supplier) => AsyncAction;
  deleteSupplier: (id: string) => AsyncAction;
  upsertSite: (site: Site) => AsyncAction;
  deleteSite: (id: string) => AsyncAction;
  upsertMaterial: (material: Material) => AsyncAction;
  deleteMaterial: (id: string) => AsyncAction;
  addReceipt: (receipt: Receipt) => AsyncAction;
  deleteReceipt: (id: string) => AsyncAction;
  addSupply: (supply: Supply) => AsyncAction;
  deleteSupply: (id: string) => AsyncAction;
  addBill: (bill: Bill) => AsyncAction;
  deleteBill: (id: string) => AsyncAction;
  addPayment: (payment: Payment) => AsyncAction;
  deletePayment: (id: string) => AsyncAction;
  addVoucher: (voucher: Voucher) => AsyncAction;
  deleteVoucher: (id: string) => AsyncAction;
  upsertEmployee: (employee: Employee) => AsyncAction;
  deleteEmployee: (id: string) => AsyncAction;
  setAttendanceDay: (employeeId: string, year: number, month: number, day: number, value: DayAttendance) => AsyncAction;
  setDeductionDecision: (employeeId: string, periodKey: string, decision: DeductionDecision) => AsyncAction;
  getDeductionDecision: (employeeId: string, periodKey: string) => DeductionDecision;
  addSalaryAdvance: (advance: SalaryAdvance) => AsyncAction;
  clearSalaryAdvance: (id: string) => AsyncAction;
  updateSettings: (settings: AppSettings) => AsyncAction;
  resetWorkspace: () => AsyncAction;
}

const AppContext = createContext<AppContextValue | null>(null);

const upsertById = <T extends { id: string }>(items: T[], item: T) =>
  items.some((current) => current.id === item.id)
    ? items.map((current) => current.id === item.id ? item : current)
    : [...items, item];

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => isSupabaseConfigured ? normalizeWorkspace(seedData) : loadLocalWorkspace());
  const [cloudLoaded, setCloudLoaded] = useState(!isSupabaseConfigured);
  const [saving, setSaving] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const { isAuthenticated, loading, sessionToken, username } = useAuth();
  const dataRef = useRef(data);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => { dataRef.current = data; }, [data]);

  const refresh = useCallback(async (token: string) => {
    const fresh = await db.loadWorkspace(token);
    dataRef.current = fresh;
    setData(fresh);
    return fresh;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      const local = loadLocalWorkspace();
      dataRef.current = local;
      setData(local);
      setCloudLoaded(true);
      return;
    }
    if (loading || !isAuthenticated || !sessionToken) {
      setCloudLoaded(false);
      return;
    }

    let cancelled = false;
    setCloudLoaded(false);
    setSyncError(null);
    refresh(sessionToken).then(() => {
      if (!cancelled) setCloudLoaded(true);
    }).catch((error) => {
      if (!cancelled) setSyncError(error instanceof Error ? error.message : 'Unable to load your workspace.');
    });
    return () => { cancelled = true; };
  }, [isAuthenticated, loading, refresh, sessionToken]);

  const commit = useCallback((mutation: Mutation, audit: WorkspaceAudit, remoteAction: RemoteAction): Promise<void> => {
    const execute = async () => {
      setSaving(true);
      setSyncError(null);
      try {
        const candidate = validateWorkspace(mutation(structuredClone(dataRef.current)));
        if (isSupabaseConfigured) {
          if (!sessionToken) throw new Error('Your session expired. Sign in again.');
          await remoteAction(sessionToken);
          try {
            await refresh(sessionToken);
          } catch {
            throw new Error('Your change was saved, but the latest data could not be reloaded. Refresh the page.');
          }
        } else {
          const saved = appendAudit(candidate, username || 'Local Owner', audit);
          saveLocalWorkspace(saved);
          dataRef.current = saved;
          setData(saved);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'That change could not be saved.';
        setSyncError(message);
        throw new Error(message);
      } finally {
        setSaving(false);
      }
    };

    const queued = saveQueue.current.then(execute, execute);
    saveQueue.current = queued.catch(() => undefined);
    return queued;
  }, [refresh, sessionToken, username]);

  const value = useMemo<AppContextValue>(() => ({
    data,
    cloudLoaded,
    saving,
    syncError,
    dismissSyncError: () => setSyncError(null),
    upsertSupplier: (supplier) => commit((current) => ({ ...current, suppliers: upsertById(current.suppliers, supplier) }), {
      action: data.suppliers.some((item) => item.id === supplier.id) ? 'Updated' : 'Created', module: 'Suppliers', documentNo: supplier.code, details: supplier.name,
    }, (token) => db.upsertSupplier(token, supplier)),
    deleteSupplier: (id) => commit((current) => ({ ...current, suppliers: current.suppliers.filter((item) => item.id !== id) }), {
      action: 'Deleted', module: 'Suppliers', documentNo: data.suppliers.find((item) => item.id === id)?.code ?? id, details: 'Supplier removed',
    }, (token) => db.deleteSupplier(token, id)),
    upsertSite: (site) => commit((current) => ({ ...current, sites: upsertById(current.sites, site) }), {
      action: data.sites.some((item) => item.id === site.id) ? 'Updated' : 'Created', module: 'Sites', documentNo: site.code, details: site.name,
    }, (token) => db.upsertSite(token, site)),
    deleteSite: (id) => commit((current) => ({ ...current, sites: current.sites.filter((item) => item.id !== id) }), {
      action: 'Deleted', module: 'Sites', documentNo: data.sites.find((item) => item.id === id)?.code ?? id, details: 'Site removed',
    }, (token) => db.deleteSite(token, id)),
    upsertMaterial: (material) => commit((current) => ({ ...current, materials: upsertById(current.materials, material) }), {
      action: data.materials.some((item) => item.id === material.id) ? 'Updated' : 'Created', module: 'Materials', documentNo: material.code, details: material.name,
    }, (token) => db.upsertMaterial(token, material)),
    deleteMaterial: (id) => commit((current) => ({ ...current, materials: current.materials.filter((item) => item.id !== id) }), {
      action: 'Deleted', module: 'Materials', documentNo: data.materials.find((item) => item.id === id)?.code ?? id, details: 'Material removed',
    }, (token) => db.deleteMaterial(token, id)),
    addReceipt: (receipt) => commit((current) => ({ ...current, receipts: [...current.receipts, receipt] }), {
      action: 'Created', module: 'Receipts', documentNo: receipt.receiptNo, details: 'Goods receipt posted',
    }, (token) => db.addReceipt(token, receipt)),
    deleteReceipt: (id) => commit((current) => ({ ...current, receipts: current.receipts.filter((item) => item.id !== id) }), {
      action: 'Deleted', module: 'Receipts', documentNo: data.receipts.find((item) => item.id === id)?.receiptNo ?? id, details: 'Goods receipt reversed',
    }, (token) => db.deleteReceipt(token, id)),
    addSupply: (supply) => commit((current) => ({ ...current, supplies: [...current.supplies, supply] }), {
      action: 'Created', module: 'Supplies', documentNo: supply.issueNo, details: 'Material issue posted',
    }, (token) => db.addSupply(token, supply)),
    deleteSupply: (id) => commit((current) => ({ ...current, supplies: current.supplies.filter((item) => item.id !== id) }), {
      action: 'Deleted', module: 'Supplies', documentNo: data.supplies.find((item) => item.id === id)?.issueNo ?? id, details: 'Material issue reversed',
    }, (token) => db.deleteSupply(token, id)),
    addBill: (bill) => commit((current) => ({ ...current, bills: [...current.bills, bill] }), {
      action: 'Created', module: 'Bills', documentNo: bill.billNo, details: `${bill.type} bill posted`,
    }, (token) => db.addBill(token, bill)),
    deleteBill: (id) => commit((current) => {
      if (current.payments.some((payment) => payment.category === 'Bill' && payment.targetId === id)) throw new Error('Delete payments against this bill before deleting the bill.');
      return { ...current, bills: current.bills.filter((item) => item.id !== id) };
    }, { action: 'Deleted', module: 'Bills', documentNo: data.bills.find((item) => item.id === id)?.billNo ?? id, details: 'Bill deleted' }, (token) => db.deleteBill(token, id)),
    addPayment: (payment) => commit((current) => ({ ...current, payments: [...current.payments, payment] }), {
      action: 'Created', module: 'Payments', documentNo: payment.paymentNo, details: `${payment.direction} ${payment.amount}`,
    }, (token) => db.addPayment(token, payment)),
    deletePayment: (id) => commit((current) => ({ ...current, payments: current.payments.filter((item) => item.id !== id) }), {
      action: 'Deleted', module: 'Payments', documentNo: data.payments.find((item) => item.id === id)?.paymentNo ?? id, details: 'Payment reversed',
    }, (token) => db.deletePayment(token, id)),
    addVoucher: (voucher) => commit((current) => ({ ...current, vouchers: [...current.vouchers, { ...voucher, sourceType: 'Manual' }] }), {
      action: 'Created', module: 'Vouchers', documentNo: voucher.voucherNo, details: 'Manual voucher posted',
    }, (token) => db.addVoucher(token, voucher)),
    deleteVoucher: (id) => commit((current) => {
      const voucher = current.vouchers.find((item) => item.id === id);
      if (voucher && (voucher.sourceType ?? 'Manual').toLowerCase() !== 'manual') throw new Error('Automatic vouchers cannot be deleted directly.');
      return { ...current, vouchers: current.vouchers.filter((item) => item.id !== id) };
    }, {
      action: 'Deleted', module: 'Vouchers', documentNo: data.vouchers.find((item) => item.id === id)?.voucherNo ?? id, details: 'Manual voucher deleted',
    }, (token) => db.deleteVoucher(token, id)),
    upsertEmployee: (employee) => commit((current) => ({ ...current, employees: upsertById(current.employees, employee) }), {
      action: data.employees.some((item) => item.id === employee.id) ? 'Updated' : 'Created', module: 'Employees', documentNo: employee.code, details: employee.name,
    }, (token) => db.upsertEmployee(token, employee)),
    deleteEmployee: (id) => commit((current) => ({ ...current, employees: current.employees.filter((item) => item.id !== id) }), {
      action: 'Deleted', module: 'Employees', documentNo: data.employees.find((item) => item.id === id)?.code ?? id, details: 'Employee removed',
    }, (token) => db.deleteEmployee(token, id)),
    setAttendanceDay: (employeeId, year, month, day, attendance) => commit((current) => ({
      ...current, attendance: { ...current.attendance, [attendanceKey(employeeId, year, month, day)]: attendance },
    }), { action: 'Updated', module: 'Attendance', documentNo: `${year}-${month}-${day}`, details: `Attendance updated for ${employeeId}` },
    (token) => db.setAttendanceDay(token, employeeId, year, month, day, attendance)),
    setDeductionDecision: (employeeId, periodKey, decision) => commit((current) => ({
      ...current, deductionDecisions: { ...current.deductionDecisions, [`${employeeId}_${periodKey}`]: decision },
    }), { action: 'Updated', module: 'Payroll', documentNo: periodKey, details: `Deduction decision updated for ${employeeId}` },
    (token) => db.setDeductionDecision(token, employeeId, periodKey, decision)),
    getDeductionDecision: (employeeId, periodKey) => data.deductionDecisions[`${employeeId}_${periodKey}`] ?? defaultDeductionDecision(),
    addSalaryAdvance: (advance) => commit((current) => ({ ...current, salaryAdvances: [...current.salaryAdvances, advance] }), {
      action: 'Created', module: 'Salary Advances', documentNo: advance.id, details: `Advance ${advance.amount} recorded`,
    }, (token) => db.addSalaryAdvance(token, advance)),
    clearSalaryAdvance: (id) => commit((current) => ({
      ...current, salaryAdvances: current.salaryAdvances.map((advance) => advance.id === id ? { ...advance, cleared: true } : advance),
    }), { action: 'Updated', module: 'Salary Advances', documentNo: id, details: 'Advance marked as settled' },
    (token) => db.clearSalaryAdvance(token, id)),
    updateSettings: (settings) => commit((current) => ({ ...current, settings }), {
      action: 'Updated', module: 'Settings', documentNo: 'COMPANY', details: 'Company settings updated',
    }, (token) => db.updateSettings(token, settings)),
    resetWorkspace: () => commit(() => normalizeWorkspace(seedData), {
      action: 'Reset', module: 'Workspace', documentNo: 'RESET', details: 'Workspace reset to a blank state',
    }, (token) => db.resetWorkspace(token)),
  }), [cloudLoaded, commit, data, saving, syncError]);

  if (isSupabaseConfigured && isAuthenticated && !cloudLoaded) {
    if (syncError) {
      return <div className="workspace-gate"><div className="workspace-gate-card"><strong>Couldn't load your workspace</strong><p>{syncError}</p><button className="button primary" onClick={() => window.location.reload()}>Retry</button></div></div>;
    }
    return <div className="workspace-gate"><div className="workspace-gate-card"><span className="workspace-gate-spinner" /><strong>Loading your workspace…</strong><p>Fetching the latest data from Supabase.</p></div></div>;
  }

  return (
    <AppContext.Provider value={value}>
      {syncError && <div className="sync-error-banner"><span>⚠ {syncError}</span><button onClick={() => setSyncError(null)} aria-label="Dismiss">✕</button></div>}
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
};

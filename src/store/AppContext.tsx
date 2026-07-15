import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as db from '../lib/storage';
import { seedData } from '../data/seed';
import { defaultDeductionDecision } from '../lib/helpers';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { AppData, AppSettings, Bill, DayAttendance, DeductionDecision, Employee, Material, Payment, Receipt, SalaryAdvance, Site, Supplier, Supply, Voucher } from '../types';

interface AppContextValue {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  cloudLoaded: boolean;
  syncError: string | null;
  upsertSupplier: (supplier: Supplier) => void;
  deleteSupplier: (id: string) => void;
  upsertSite: (site: Site) => void;
  deleteSite: (id: string) => void;
  upsertMaterial: (material: Material) => void;
  deleteMaterial: (id: string) => void;
  addReceipt: (receipt: Receipt) => void;
  deleteReceipt: (id: string) => void;
  addSupply: (supply: Supply) => void;
  deleteSupply: (id: string) => void;
  addBill: (bill: Bill) => void;
  deleteBill: (id: string) => void;
  addPayment: (payment: Payment) => void;
  deletePayment: (id: string) => void;
  addVoucher: (voucher: Voucher) => void;
  deleteVoucher: (id: string) => void;
  upsertEmployee: (employee: Employee) => void;
  deleteEmployee: (id: string) => void;
  setAttendanceDay: (employeeId: string, year: number, month: number, day: number, value: DayAttendance) => void;
  setDeductionDecision: (employeeId: string, decision: DeductionDecision) => void;
  getDeductionDecision: (employeeId: string) => DeductionDecision;
  addSalaryAdvance: (advance: SalaryAdvance) => void;
  clearSalaryAdvance: (id: string) => void;
  resetWorkspace: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => structuredClone(seedData));
  const [cloudLoaded, setCloudLoaded] = useState(!isSupabaseConfigured);
  const [syncError, setSyncError] = useState<string | null>(null);
  const { isAuthenticated, loading, sessionToken } = useAuth();
  const lastPushedSettings = useRef<string>('');
  const skipNextSettingsPush = useRef(false);

  const refresh = useCallback(async (token: string) => {
    const fresh = await db.loadWorkspace(token);
    skipNextSettingsPush.current = true;
    lastPushedSettings.current = JSON.stringify(fresh.settings);
    setData(fresh);
    return fresh;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
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
      console.error('Unable to load Supabase workspace', error);
      if (!cancelled) setSyncError(error instanceof Error ? error.message : 'Unable to load your workspace from Supabase.');
    });

    return () => { cancelled = true; };
  }, [isAuthenticated, loading, sessionToken, refresh]);

  // Settings is the one slice pages still edit via raw setData (see Settings.tsx),
  // so it gets its own debounced watcher instead of a dedicated action creator.
  useEffect(() => {
    if (!isSupabaseConfigured || !isAuthenticated || !cloudLoaded || !sessionToken) return;
    const snapshot = JSON.stringify(data.settings);
    if (skipNextSettingsPush.current) {
      skipNextSettingsPush.current = false;
      lastPushedSettings.current = snapshot;
      return;
    }
    if (snapshot === lastPushedSettings.current) return;
    const handle = window.setTimeout(() => {
      db.updateSettings(sessionToken, data.settings as AppSettings).then(() => {
        lastPushedSettings.current = snapshot;
        setSyncError(null);
      }).catch((error) => {
        console.error('Unable to save settings to Supabase', error);
        setSyncError(error instanceof Error ? error.message : 'Unable to save settings to Supabase.');
      });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [cloudLoaded, data.settings, isAuthenticated, sessionToken]);

  const run = useCallback((action: () => Promise<unknown>) => {
    if (!isSupabaseConfigured || !sessionToken) return;
    void action().then(() => refresh(sessionToken)).then(() => setSyncError(null)).catch((error) => {
      console.error('Supabase write failed', error);
      setSyncError(error instanceof Error ? error.message : 'That change could not be saved to Supabase.');
    });
  }, [refresh, sessionToken]);

  const value = useMemo<AppContextValue>(() => ({
    data,
    setData,
    cloudLoaded,
    syncError,
    upsertSupplier: (supplier) => run(() => db.upsertSupplier(sessionToken!, supplier)),
    deleteSupplier: (id) => run(() => db.deleteSupplier(sessionToken!, id)),
    upsertSite: (site) => run(() => db.upsertSite(sessionToken!, site)),
    deleteSite: (id) => run(() => db.deleteSite(sessionToken!, id)),
    upsertMaterial: (material) => run(() => db.upsertMaterial(sessionToken!, material)),
    deleteMaterial: (id) => run(() => db.deleteMaterial(sessionToken!, id)),
    addReceipt: (receipt) => run(() => db.addReceipt(sessionToken!, receipt)),
    deleteReceipt: (id) => run(() => db.deleteReceipt(sessionToken!, id)),
    addSupply: (supply) => run(() => db.addSupply(sessionToken!, supply)),
    deleteSupply: (id) => run(() => db.deleteSupply(sessionToken!, id)),
    addBill: (bill) => run(() => db.addBill(sessionToken!, bill)),
    deleteBill: (id) => run(() => db.deleteBill(sessionToken!, id)),
    addPayment: (payment) => run(() => db.addPayment(sessionToken!, payment)),
    deletePayment: (id) => run(() => db.deletePayment(sessionToken!, id)),
    addVoucher: (voucher) => run(() => db.addVoucher(sessionToken!, voucher)),
    deleteVoucher: (id) => run(() => db.deleteVoucher(sessionToken!, id)),
    upsertEmployee: (employee) => run(() => db.upsertEmployee(sessionToken!, employee)),
    deleteEmployee: (id) => run(() => db.deleteEmployee(sessionToken!, id)),
    setAttendanceDay: (employeeId, year, month, day, value) => run(() => db.setAttendanceDay(sessionToken!, employeeId, year, month, day, value)),
    setDeductionDecision: (employeeId, decision) => run(() => db.setDeductionDecision(sessionToken!, employeeId, decision)),
    getDeductionDecision: (employeeId) => data.deductionDecisions[employeeId] ?? defaultDeductionDecision(),
    addSalaryAdvance: (advance) => run(() => db.addSalaryAdvance(sessionToken!, advance)),
    clearSalaryAdvance: (id) => run(() => db.clearSalaryAdvance(sessionToken!, id)),
    resetWorkspace: () => run(() => db.resetWorkspace(sessionToken!)),
  }), [cloudLoaded, data, run, sessionToken, syncError]);

  if (isSupabaseConfigured && isAuthenticated && !cloudLoaded) {
    if (syncError) {
      return (
        <div className="workspace-gate">
          <div className="workspace-gate-card">
            <strong>Couldn't load your workspace</strong>
            <p>{syncError}</p>
            <button className="button primary" onClick={() => window.location.reload()}>Retry</button>
          </div>
        </div>
      );
    }
    return (
      <div className="workspace-gate">
        <div className="workspace-gate-card">
          <span className="workspace-gate-spinner" />
          <strong>Loading your workspace…</strong>
          <p>Fetching the latest data from Supabase.</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={value}>
      {syncError && (
        <div className="sync-error-banner">
          <span>⚠ {syncError}</span>
          <button onClick={() => setSyncError(null)} aria-label="Dismiss">✕</button>
        </div>
      )}
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
};

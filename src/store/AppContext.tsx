import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadLocalData, loadPersistedData, resetLocalData, savePersistedData } from '../lib/storage';
import { today, uid } from '../lib/helpers';
import { attendanceKey, defaultDeductionDecision } from '../lib/helpers';
import { isSupabaseConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { AppData, AuditEntry, Bill, DayAttendance, DeductionDecision, Employee, Material, Payment, Receipt, SalaryAdvance, Site, Supplier, Supply, Voucher } from '../types';

interface AppContextValue {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
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
const upsert = <T extends { id: string }>(items: T[], item: T) => items.some((candidate) => candidate.id === item.id)
  ? items.map((candidate) => candidate.id === item.id ? item : candidate)
  : [item, ...items];

const audit = (actor: string, action: AuditEntry['action'], module: string, documentNo: string, details: string): AuditEntry => ({
  id: uid('audit'), timestamp: new Date().toISOString(), actor, action, module, documentNo, details,
});

const recomputeBillStatuses = (data: AppData): Bill[] => data.bills.map((bill) => {
  const total = bill.items.reduce((sum, item) => sum + item.quantity * item.rate * (1 + item.taxRate / 100), 0) + bill.otherCharges - bill.discount;
  const paid = data.payments.filter((entry) => entry.billId === bill.id).reduce((sum, entry) => sum + entry.amount, 0);
  const status = paid >= total && total > 0 ? 'Paid' as const : paid > 0 ? 'Partially Paid' as const : bill.dueDate < today() ? 'Overdue' as const : 'Unpaid' as const;
  return { ...bill, status };
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadLocalData());
  const [cloudLoaded, setCloudLoaded] = useState(!isSupabaseConfigured);
  const cloudVersion = useRef<number | null>(null);
  const lastSavedSnapshot = useRef('');
  const { isAuthenticated, loading, sessionToken, username } = useAuth();
  const actor = username || 'Admin';

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
    loadPersistedData(sessionToken).then((loaded) => {
      if (cancelled) return;
      cloudVersion.current = loaded.version;
      lastSavedSnapshot.current = JSON.stringify(loaded.data);
      setData(loaded.data);
      setCloudLoaded(true);
    }).catch((error) => {
      console.error('Unable to initialize Supabase workspace', error);
      if (!cancelled) setCloudLoaded(false);
    });

    return () => { cancelled = true; };
  }, [isAuthenticated, loading, sessionToken]);

  useEffect(() => {
    if (isSupabaseConfigured && (!isAuthenticated || !cloudLoaded || !sessionToken)) return;
    const snapshot = JSON.stringify(data);
    if (isSupabaseConfigured && snapshot === lastSavedSnapshot.current) return;
    const handle = window.setTimeout(() => {
      void savePersistedData(data, sessionToken, cloudVersion.current).then((result) => {
        if (!result.ok) {
          console.warn(result.message ?? 'Cloud workspace changed before this save.');
          if (sessionToken) {
            void loadPersistedData(sessionToken).then((loaded) => {
              cloudVersion.current = loaded.version;
              lastSavedSnapshot.current = JSON.stringify(loaded.data);
              setData(loaded.data);
            });
          }
          return;
        }
        cloudVersion.current = result.version;
        lastSavedSnapshot.current = snapshot;
      }).catch((error) => {
        console.error('Unable to save Supabase workspace', error);
      });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [cloudLoaded, data, isAuthenticated, sessionToken]);

  const mutate = useCallback((fn: (current: AppData) => AppData) => setData((current) => fn(current)), []);

  const value = useMemo<AppContextValue>(() => ({
    data,
    setData,
    upsertSupplier: (supplier) => mutate((current) => ({ ...current, suppliers: upsert(current.suppliers, supplier), auditLog: [audit(actor, current.suppliers.some((item) => item.id === supplier.id) ? 'Updated' : 'Created', 'Suppliers', supplier.code, supplier.name), ...current.auditLog] })),
    deleteSupplier: (id) => mutate((current) => { if (current.receipts.some((receipt) => receipt.supplierId === id) || current.bills.some((bill) => bill.supplierId === id)) return current; const item = current.suppliers.find((candidate) => candidate.id === id); return { ...current, suppliers: current.suppliers.filter((candidate) => candidate.id !== id), auditLog: [audit(actor, 'Deleted', 'Suppliers', item?.code ?? id, item?.name ?? ''), ...current.auditLog] }; }),
    upsertSite: (site) => mutate((current) => ({ ...current, sites: upsert(current.sites, site), auditLog: [audit(actor, current.sites.some((item) => item.id === site.id) ? 'Updated' : 'Created', 'Sites', site.code, site.name), ...current.auditLog] })),
    deleteSite: (id) => mutate((current) => { if (current.receipts.some((receipt) => receipt.siteId === id) || current.supplies.some((supply) => supply.siteId === id) || current.bills.some((bill) => bill.siteId === id)) return current; const item = current.sites.find((candidate) => candidate.id === id); return { ...current, sites: current.sites.filter((candidate) => candidate.id !== id), auditLog: [audit(actor, 'Deleted', 'Sites', item?.code ?? id, item?.name ?? ''), ...current.auditLog] }; }),
    upsertMaterial: (material) => mutate((current) => ({ ...current, materials: upsert(current.materials, material), auditLog: [audit(actor, current.materials.some((item) => item.id === material.id) ? 'Updated' : 'Created', 'Materials', material.code, material.name), ...current.auditLog] })),
    deleteMaterial: (id) => mutate((current) => { if (current.receipts.some((receipt) => receipt.items.some((item) => item.materialId === id)) || current.supplies.some((supply) => supply.items.some((item) => item.materialId === id)) || current.bills.some((bill) => bill.items.some((item) => item.materialId === id))) return current; const item = current.materials.find((candidate) => candidate.id === id); return { ...current, materials: current.materials.filter((candidate) => candidate.id !== id), auditLog: [audit(actor, 'Deleted', 'Materials', item?.code ?? id, item?.name ?? ''), ...current.auditLog] }; }),
    addReceipt: (receipt) => mutate((current) => ({ ...current, receipts: [receipt, ...current.receipts], auditLog: [audit(actor, 'Created', 'Material Receipts', receipt.receiptNo, `${receipt.items.length} stock lines posted`), ...current.auditLog] })),
    deleteReceipt: (id) => mutate((current) => { const item = current.receipts.find((candidate) => candidate.id === id); return { ...current, receipts: current.receipts.filter((candidate) => candidate.id !== id), auditLog: [audit(actor, 'Deleted', 'Material Receipts', item?.receiptNo ?? id, 'Stock recalculated'), ...current.auditLog] }; }),
    addSupply: (supply) => mutate((current) => ({ ...current, supplies: [supply, ...current.supplies], auditLog: [audit(actor, 'Created', 'Material Issues', supply.issueNo, `${supply.items.length} stock lines issued`), ...current.auditLog] })),
    deleteSupply: (id) => mutate((current) => { const item = current.supplies.find((candidate) => candidate.id === id); return { ...current, supplies: current.supplies.filter((candidate) => candidate.id !== id), auditLog: [audit(actor, 'Deleted', 'Material Issues', item?.issueNo ?? id, 'Stock and accounting recalculated'), ...current.auditLog] }; }),
    addBill: (bill) => mutate((current) => { const next = { ...current, bills: [bill, ...current.bills], auditLog: [audit(actor, 'Created', 'Bills & Invoices', bill.billNo, `${bill.type}; inventory: ${bill.inventoryPosting}`), ...current.auditLog] }; return { ...next, bills: recomputeBillStatuses(next) }; }),
    deleteBill: (id) => mutate((current) => { const item = current.bills.find((candidate) => candidate.id === id); const next = { ...current, bills: current.bills.filter((candidate) => candidate.id !== id), payments: current.payments.filter((candidate) => candidate.billId !== id), auditLog: [audit(actor, 'Deleted', 'Bills & Invoices', item?.billNo ?? id, 'Invoice, stock posting, accounting voucher and linked payments removed'), ...current.auditLog] }; return { ...next, bills: recomputeBillStatuses(next) }; }),
    addPayment: (payment) => mutate((current) => { const next = { ...current, payments: [payment, ...current.payments], auditLog: [audit(actor, 'Created', 'Payments', payment.paymentNo, `${payment.direction} ${payment.amount} via ${payment.mode}`), ...current.auditLog] }; return { ...next, bills: recomputeBillStatuses(next) }; }),
    deletePayment: (id) => mutate((current) => { const item = current.payments.find((candidate) => candidate.id === id); const next = { ...current, payments: current.payments.filter((candidate) => candidate.id !== id), auditLog: [audit(actor, 'Deleted', 'Payments', item?.paymentNo ?? id, 'Bill balance recalculated'), ...current.auditLog] }; return { ...next, bills: recomputeBillStatuses(next) }; }),
    addVoucher: (voucher) => mutate((current) => ({ ...current, vouchers: [voucher, ...current.vouchers], auditLog: [audit(actor, 'Created', 'Accounting Vouchers', voucher.voucherNo, `${voucher.type} voucher posted`), ...current.auditLog] })),
    deleteVoucher: (id) => mutate((current) => { const item = current.vouchers.find((candidate) => candidate.id === id); return { ...current, vouchers: current.vouchers.filter((candidate) => candidate.id !== id), auditLog: [audit(actor, 'Deleted', 'Accounting Vouchers', item?.voucherNo ?? id, 'Manual voucher removed'), ...current.auditLog] }; }),
    upsertEmployee: (employee) => mutate((current) => ({ ...current, employees: upsert(current.employees, employee), auditLog: [audit(actor, current.employees.some((item) => item.id === employee.id) ? 'Updated' : 'Created', 'Staff & Attendance', employee.code, employee.name), ...current.auditLog] })),
    deleteEmployee: (id) => mutate((current) => { const item = current.employees.find((candidate) => candidate.id === id); return { ...current, employees: current.employees.filter((candidate) => candidate.id !== id), auditLog: [audit(actor, 'Deleted', 'Staff & Attendance', item?.code ?? id, item?.name ?? ''), ...current.auditLog] }; }),
    setAttendanceDay: (employeeId, year, month, day, value) => mutate((current) => ({ ...current, attendance: { ...current.attendance, [attendanceKey(employeeId, year, month, day)]: value } })),
    setDeductionDecision: (employeeId, decision) => mutate((current) => ({ ...current, deductionDecisions: { ...current.deductionDecisions, [employeeId]: decision } })),
    getDeductionDecision: (employeeId) => data.deductionDecisions[employeeId] ?? defaultDeductionDecision(),
    addSalaryAdvance: (advance) => mutate((current) => ({ ...current, salaryAdvances: [advance, ...current.salaryAdvances], auditLog: [audit(actor, 'Created', 'Staff & Attendance', advance.id, `Advance of ${advance.amount} recorded`), ...current.auditLog] })),
    clearSalaryAdvance: (id) => mutate((current) => ({ ...current, salaryAdvances: current.salaryAdvances.map((advance) => advance.id === id ? { ...advance, cleared: true } : advance), auditLog: [audit(actor, 'Updated', 'Staff & Attendance', id, 'Advance marked as cleared'), ...current.auditLog] })),
    resetWorkspace: () => {
      const reset = resetLocalData();
      reset.auditLog = [audit(actor, 'Reset', 'Company', 'RESET', 'Workspace cleared to blank defaults'), ...reset.auditLog];
      setData(reset);
      void savePersistedData(reset, sessionToken, cloudVersion.current).then((result) => {
        if (result.ok) cloudVersion.current = result.version;
      });
    },
  }), [actor, data, mutate, sessionToken]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
};

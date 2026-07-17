import { supabase } from './supabase';
import { normalizeWorkspace } from './workspace';
import type {
  AppData, AppSettings, Bill, DayAttendance, DeductionDecision, Employee,
  Material, Payment, Receipt, SalaryAdvance, Site, Supplier, Supply, Voucher,
} from '../types';

const rpc = async <T = unknown>(fn: string, params: Record<string, unknown>): Promise<T> => {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message);
  return data as T;
};

export const loadWorkspace = async (sessionToken: string): Promise<AppData> =>
  normalizeWorkspace(await rpc<AppData>('get_workspace', { p_session_token: sessionToken }));

export const upsertSupplier = (token: string, supplier: Supplier) =>
  rpc('upsert_supplier', { p_session_token: token, p_payload: supplier });
export const deleteSupplier = (token: string, id: string) =>
  rpc('delete_supplier', { p_session_token: token, p_id: id });

export const upsertSite = (token: string, site: Site) =>
  rpc('upsert_site', { p_session_token: token, p_payload: site });
export const deleteSite = (token: string, id: string) =>
  rpc('delete_site', { p_session_token: token, p_id: id });

export const upsertMaterial = (token: string, material: Material) =>
  rpc('upsert_material', { p_session_token: token, p_payload: material });
export const deleteMaterial = (token: string, id: string) =>
  rpc('delete_material', { p_session_token: token, p_id: id });

export const upsertEmployee = (token: string, employee: Employee) =>
  rpc('upsert_employee', { p_session_token: token, p_payload: employee });
export const deleteEmployee = (token: string, id: string) =>
  rpc('delete_employee', { p_session_token: token, p_id: id });

export const addReceipt = (token: string, receipt: Receipt) =>
  rpc('add_receipt', { p_session_token: token, p_payload: receipt });
export const deleteReceipt = (token: string, id: string) =>
  rpc('delete_receipt', { p_session_token: token, p_id: id });

export const addSupply = (token: string, supply: Supply) =>
  rpc('add_supply', { p_session_token: token, p_payload: supply });
export const deleteSupply = (token: string, id: string) =>
  rpc('delete_supply', { p_session_token: token, p_id: id });

export const addBill = (token: string, bill: Bill) =>
  rpc('add_bill', { p_session_token: token, p_payload: bill });
export const deleteBill = (token: string, id: string) =>
  rpc('delete_bill', { p_session_token: token, p_id: id });

export const addPayment = (token: string, payment: Payment) =>
  rpc('add_payment', { p_session_token: token, p_payload: payment });
export const deletePayment = (token: string, id: string) =>
  rpc('delete_payment', { p_session_token: token, p_id: id });

export const addVoucher = (token: string, voucher: Voucher) =>
  rpc('add_voucher', { p_session_token: token, p_payload: voucher });
export const deleteVoucher = (token: string, id: string) =>
  rpc('delete_voucher', { p_session_token: token, p_id: id });

export const setAttendanceDay = (
  token: string,
  employeeId: string,
  year: number,
  month: number,
  day: number,
  value: DayAttendance,
) => rpc('set_attendance_day', {
  p_session_token: token,
  p_employee_id: employeeId,
  p_year: year,
  p_month: month,
  p_day: day,
  p_payload: value,
});

export const setDeductionDecision = (
  token: string,
  employeeId: string,
  periodKey: string,
  decision: DeductionDecision,
) => rpc('set_deduction_decision', {
  p_session_token: token,
  p_employee_id: employeeId,
  p_period_key: periodKey,
  p_payload: decision,
});

export const addSalaryAdvance = (token: string, advance: SalaryAdvance) =>
  rpc('add_salary_advance', {
    p_session_token: token,
    p_payload: { ...advance, date: advance.givenDate },
  });
export const clearSalaryAdvance = (token: string, id: string) =>
  rpc('clear_salary_advance', { p_session_token: token, p_id: id });

export const updateSettings = (token: string, settings: AppSettings) =>
  rpc('update_settings', { p_session_token: token, p_payload: settings });

export const resetWorkspace = (token: string) =>
  rpc('reset_workspace', { p_session_token: token });

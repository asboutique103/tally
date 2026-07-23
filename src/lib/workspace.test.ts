import { describe, expect, it } from 'vitest';
import { seedData } from '../data/seed';
import type { AppData, Bill, DeductionDecision, Employee, Material, Payment, Receipt, SalaryAdvance, Site, Supply, Voucher } from '../types';
import { accountBalances, allVouchers, attendanceKey, calcEmployeeSalary, csvCell, departmentAnalytics, outstandingAdvanceFor, summarizeAttendance, voucherTotals } from './helpers';
import { employeeDepartment, employeeGroupAssignment, setEmployeeGroup } from './employeeGroups';
import { validateWorkspace } from './workspace';

const now = '2026-07-17T00:00:00.000Z';
const material: Material = { id: 'm1', code: 'MAT-1', name: 'Cement', category: 'Cement', unit: 'Bag', standardRate: 400, openingStock: 5, createdAt: now };
const site: Site = { id: 's1', code: 'SITE-1', name: 'Site One', clientName: 'Client', location: 'Chennai', phone: '9876543210', startDate: '2026-04-01', expectedEndDate: '2027-03-31', status: 'Active', createdAt: now };
const item = { id: 'i1', materialId: material.id, quantity: 2, rate: 500, taxRate: 18 };
const bill: Bill = { id: 'b1', billNo: 'INV-1', type: 'Client', date: '2026-07-01', dueDate: '2026-07-31', siteId: site.id, partyName: 'Client', items: [item], discount: 0, otherCharges: 0, gstEnabled: true, gstRate: 18, notes: '', status: 'Unpaid', inventoryPosting: 'Accounting Only', createdAt: now };

const workspace = (): AppData => ({
  ...structuredClone(seedData),
  materials: [material],
  sites: [site],
  bills: [bill],
});

describe('workspace integrity', () => {
  it('calculates 1.5-day and 2-day work multipliers in attendance payroll', () => {
    const data = workspace();
    const employee: Employee = { id: 'e-multi', code: 'EMP-M', name: 'Electrician', branch: 'Electrician', department: 'Site', payCycle: 'Monthly', grossSalary: 1000, salaryAdvance: 0, otherDeduction: 0, status: 'Active', createdAt: now };
    data.employees = [employee];
    data.attendance[attendanceKey(employee.id, 2026, 7, 1)] = { present: true, half: true, woff: false, absent: false };
    data.attendance[attendanceKey(employee.id, 2026, 7, 2)] = { present: true, half: false, woff: true, absent: false };
    expect(summarizeAttendance(data, employee.id, 2026, 7)).toMatchObject({ workingDays: 2, payableDays: 3.5, presentDays: 3.5 });
    expect(calcEmployeeSalary(data, employee, 2026, 7, { deductAdvance: false, deductOther: false, advanceDeducted: 0 }).earned).toBe(3500);
  });

  it('stores group assignments without losing the employee department', () => {
    const employee: Employee = { id: 'e-group', code: 'EMP-G', name: 'Supervisor', branch: 'Mesthri', department: 'Operations', payCycle: 'Monthly', grossSalary: 900, salaryAdvance: 0, otherDeduction: 0, status: 'Active', createdAt: now };
    const grouped = setEmployeeGroup(employee, { name: 'Site Team A', role: 'Group Head', isHead: true });
    expect(employeeDepartment(grouped)).toBe('Operations');
    expect(employeeGroupAssignment(grouped)).toEqual({ name: 'Site Team A', role: 'Group Head', isHead: true });
  });

  it('rejects stock movements that would make inventory negative', () => {
    const data = workspace();
    const supply: Supply = { id: 'is1', issueNo: 'ISS-1', date: '2026-07-02', siteId: site.id, items: [{ ...item, quantity: 6 }], notes: '', gstEnabled: false, gstRate: 0, createdAt: now };
    data.supplies = [supply];
    expect(() => validateWorkspace(data)).toThrow(/Insufficient stock/);
  });

  it('rejects a payment with the wrong direction and an overpayment', () => {
    const wrongDirection = workspace();
    const payment: Payment = { id: 'p1', paymentNo: 'PAY-1', date: '2026-07-02', category: 'Bill', targetId: bill.id, partyName: 'Client', direction: 'Paid', amount: 100, mode: 'Cash', reference: '', notes: '', createdAt: now };
    wrongDirection.payments = [payment];
    expect(() => validateWorkspace(wrongDirection)).toThrow(/wrong direction/);

    const overpaid = workspace();
    overpaid.payments = [{ ...payment, direction: 'Received', amount: 1181 }];
    expect(() => validateWorkspace(overpaid)).toThrow(/exceed/);
  });

  it('rejects deletion of a referenced master record', () => {
    const data = workspace();
    const receipt: Receipt = { id: 'r1', receiptNo: 'GRN-1', date: '2026-07-01', supplierId: 'missing', invoiceNo: '', vehicleNo: '', destination: 'Central Store', items: [item], notes: '', createdAt: now };
    data.receipts = [receipt];
    expect(() => validateWorkspace(data)).toThrow(/unknown supplier/);
  });

  it('keeps the GST workspace currency fixed to INR', () => {
    const data = workspace();
    data.settings.currency = 'USD';
    expect(validateWorkspace(data).settings.currency).toBe('INR');
  });
});

describe('accounting and exports', () => {
  it('uses balanced database vouchers without generating duplicates', () => {
    const data = workspace();
    data.vouchers = [{
      id: 'db-bill-b1', voucherNo: bill.billNo, type: 'Credit Note', date: bill.date,
      partyName: bill.partyName, reference: '', narration: '', sourceType: 'Bill', sourceId: bill.id, createdAt: now,
      lines: [
        { id: 'vl1', accountId: 'acc-receivable', debit: 1180, credit: 0 },
        { id: 'vl2', accountId: 'acc-sales', debit: 0, credit: 1180 },
      ],
    }];
    const vouchers = allVouchers(validateWorkspace(data));
    expect(vouchers.filter((voucher) => voucher.sourceType === 'Bill')).toHaveLength(1);
    expect(vouchers.some((voucher) => voucher.id === 'db-bill-b1')).toBe(true);
    vouchers.forEach((voucher) => {
      const totals = voucherTotals(voucher);
      expect(totals.debit).toBeCloseTo(totals.credit, 2);
    });
  });

  it('scopes account balances to the requested financial period', () => {
    const data = workspace();
    const manual: Voucher = { id: 'v1', voucherNo: 'OLD-1', type: 'Journal', date: '2025-01-01', partyName: '', reference: '', narration: '', sourceType: 'Manual', createdAt: now, lines: [
      { id: 'l1', accountId: 'acc-cash', debit: 100, credit: 0 },
      { id: 'l2', accountId: 'acc-equity', debit: 0, credit: 100 },
    ] };
    data.vouchers = [manual];
    const cash = accountBalances(validateWorkspace(data), '2026-04-01', '2027-03-31').find((account) => account.id === 'acc-cash');
    expect(cash?.debit).toBe(0);
  });

  it('neutralizes spreadsheet formulas in CSV cells', () => {
    expect(csvCell('=2+2')).toBe("'=2+2");
    expect(csvCell('@SUM(A1:A2)')).toBe("'@SUM(A1:A2)");
    expect(csvCell('safe')).toBe('safe');
  });

  it('uses the selected month deduction decision in department analytics', () => {
    const data = workspace();
    const employee: Employee = {
      id: 'e1', code: 'EMP-1', name: 'Employee', branch: 'Labor', department: 'Civil',
      payCycle: 'Monthly', grossSalary: 100, salaryAdvance: 0, otherDeduction: 25,
      status: 'Active', createdAt: now,
    };
    data.employees = [employee];
    data.attendance[attendanceKey(employee.id, 2026, 7, 1)] = { present: true, half: false, woff: false, absent: false };
    data.deductionDecisions[employee.id] = { deductAdvance: false, deductOther: true, advanceDeducted: 0 };
    data.deductionDecisions[`${employee.id}_month-2026-07`] = { deductAdvance: false, deductOther: false, advanceDeducted: 0 };

    expect(departmentAnalytics(data, [employee], 2026, 7)[0].net).toBe(100);
  });
});

describe('salary advance deductions', () => {
  const employee: Employee = {
    id: 'e2', code: 'EMP-2', name: 'Worker', branch: 'Labor', department: 'Civil',
    payCycle: 'Monthly', grossSalary: 100, salaryAdvance: 0, otherDeduction: 0,
    status: 'Active', createdAt: now,
  };
  const advance: SalaryAdvance = { id: 'adv1', employeeId: employee.id, amount: 500, givenDate: '2026-06-01', note: '', cleared: false, createdAt: now };

  it('does not re-offer the same outstanding amount to every period once some has been recorded as deducted', () => {
    const data = workspace();
    data.employees = [employee];
    data.salaryAdvances = [advance];

    // Nothing recovered yet: the full amount is outstanding and available to any period.
    expect(outstandingAdvanceFor(data, employee.id)).toBe(500);

    // July already recovered 200 of it via payroll.
    data.deductionDecisions[`${employee.id}_month-2026-07`] = { deductAdvance: true, deductOther: false, advanceDeducted: 200 };
    expect(outstandingAdvanceFor(data, employee.id)).toBe(300);

    // August must only ever see the remaining 300 — not the original 500 again.
    expect(outstandingAdvanceFor(data, employee.id, 'month-2026-08')).toBe(300);

    // Re-opening July itself should show what was available *before* July's own deduction
    // (i.e. its own contribution added back), so toggling July on/off is stable.
    expect(outstandingAdvanceFor(data, employee.id, 'month-2026-07')).toBe(500);
  });

  it('trusts the committed advanceDeducted amount rather than recomputing min(outstanding, earned) live', () => {
    const data = workspace();
    data.employees = [employee];
    data.salaryAdvances = [advance];
    data.attendance[attendanceKey(employee.id, 2026, 7, 1)] = { present: true, half: false, woff: false, absent: false };

    const decision = { deductAdvance: true, deductOther: false, advanceDeducted: 200 };
    const breakdown = calcEmployeeSalary(data, employee, 2026, 7, decision);
    // Even though 500 is still nominally "outstanding" in the raw advance record, only the
    // committed 200 for this period should hit net pay.
    expect(breakdown.advanceDeduction).toBe(200);

    // Unticking the box should deduct nothing, regardless of what was previously stored.
    const untouched = calcEmployeeSalary(data, employee, 2026, 7, { ...decision, deductAdvance: false });
    expect(untouched.advanceDeduction).toBe(0);
  });

  it('repairs a legacy checked decision that has no saved advanceDeducted amount', () => {
    const data = workspace();
    data.employees = [employee];
    data.salaryAdvances = [advance];
    data.attendance[attendanceKey(employee.id, 2026, 7, 1)] = { present: true, half: false, woff: false, absent: false };
    const legacyDecision = { deductAdvance: true, deductOther: false } as DeductionDecision;

    expect(calcEmployeeSalary(data, employee, 2026, 7, legacyDecision)).toMatchObject({
      earned: 100,
      advanceDeduction: 100,
      totalDeductions: 100,
      net: 0,
    });
  });

  it('keeps the current period deduction available while calculating that period', () => {
    const data = workspace();
    data.employees = [employee];
    data.salaryAdvances = [advance];
    data.attendance[attendanceKey(employee.id, 2026, 7, 1)] = { present: true, half: false, woff: false, absent: false };
    const decision = { deductAdvance: true, deductOther: false, advanceDeducted: 80 };
    data.deductionDecisions[`${employee.id}_month-2026-07`] = decision;

    expect(calcEmployeeSalary(data, employee, 2026, 7, decision)).toMatchObject({
      advanceDeduction: 80,
      totalDeductions: 80,
      net: 20,
    });
  });

  it('clamps outstanding at zero once a cleared advance and recorded deductions overlap', () => {
    const data = workspace();
    data.employees = [employee];
    data.salaryAdvances = [{ ...advance, cleared: true }];
    data.deductionDecisions[`${employee.id}_month-2026-07`] = { deductAdvance: true, deductOther: false, advanceDeducted: 200 };
    expect(outstandingAdvanceFor(data, employee.id)).toBe(0);
  });
});

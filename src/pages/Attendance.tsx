import { Fragment, useCallback, useMemo, useState, type FormEvent } from 'react';
import { Ban, Check, CreditCard, Download, Pencil, Plus, TrendingUp, Trash2, UserPlus, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { StatCard } from '../components/StatCard';
import {
  attendanceKey, attendanceMixFor, branchAnalytics, calcEmployeeSalary, calcEmployeeSalaryForDates, currency, daysInMonth,
  defaultDayAttendance, departmentAnalytics, downloadCsv, monthLabel, number, outstandingAdvanceFor,
  summarizeAttendance, summarizeAttendanceForDates, today, uid, weekDateParts, weekLabel,
} from '../lib/helpers';
import { useApp } from '../store/AppContext';
import type { DayAttendance, DeductionDecision, Employee, PayCycle, StaffBranch } from '../types';

const branches: StaffBranch[] = ['Mesthri', 'Electrician', 'Tile Worker', 'Painter', 'Labor'];
const CHART_COLORS = ['#5c5ee5', '#2fb7a3', '#f5a524', '#e5544f', '#7c3aed', '#0ea5e9'];

const emptyEmployee = (): Employee => ({
  id: uid('emp'), code: '', name: '', branch: 'Labor', department: '', payCycle: 'Monthly', grossSalary: 0,
  salaryAdvance: 0, otherDeduction: 0, accountNumber: '', bankName: '',
  ifscCode: '', status: 'Active', createdAt: new Date().toISOString(),
});

const currentYM = () => { const now = new Date(); return { year: now.getFullYear(), month: now.getMonth() + 1 }; };
const mondayIso = (date = new Date()) => { const day = date.getDay(); const diff = day === 0 ? -6 : 1 - day; const monday = new Date(date); monday.setDate(date.getDate() + diff); return monday.toISOString().slice(0, 10); };

function dayState(entry?: DayAttendance) {
  if (!entry) return 'blank';
  if (entry.woff) return 'leave';
  if (entry.half) return 'half';
  if (entry.present) return 'present';
  if (entry.absent) return 'absent';
  return 'blank';
}

const DAY_LABEL: Record<string, string> = { blank: '', present: 'P', absent: 'A', half: 'HD', leave: 'L' };

export function Attendance() {
  const app = useApp();
  const { data } = app;
  const [tab, setTab] = useState<'Attendance' | 'Salary' | 'Advances' | 'Employees' | 'Analytics'>('Attendance');
  const [{ year, month }, setYM] = useState(currentYM());
  const [payCycleView, setPayCycleView] = useState<PayCycle>('Monthly');
  const [weekStart, setWeekStart] = useState(mondayIso());
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<Employee>(emptyEmployee());
  const [advanceModal, setAdvanceModal] = useState<Employee | null>(null);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceDate, setAdvanceDate] = useState(today());
  const [advanceReason, setAdvanceReason] = useState('');

  const total = daysInMonth(year, month);
  const label = monthLabel(year, month);
  const weekParts = useMemo(() => weekDateParts(weekStart), [weekStart]);
  const periodLabel = payCycleView === 'Weekly' ? weekLabel(weekStart) : label;
  const periodKey = payCycleView === 'Weekly' ? `week-${weekStart}` : `month-${year}-${String(month).padStart(2, '0')}`;
  const activeEmployees = useMemo(() => data.employees.filter((e) => e.status === 'Active'), [data.employees]);
  const cycleEmployees = useMemo(() => activeEmployees.filter((e) => e.payCycle === payCycleView), [activeEmployees, payCycleView]);
  const filtered = useMemo(
    () => cycleEmployees.filter((e) => `${e.name} ${e.department} ${e.code}`.toLowerCase().includes(query.toLowerCase())),
    [cycleEmployees, query],
  );
  const allFiltered = useMemo(
    () => activeEmployees.filter((e) => `${e.name} ${e.department} ${e.code}`.toLowerCase().includes(query.toLowerCase())),
    [activeEmployees, query],
  );

  const getDecision = useCallback((employeeId: string): DeductionDecision => app.getDeductionDecision(employeeId, periodKey), [app, periodKey]);

  const cycleDay = (emp: Employee, day: number) => {
    const key = attendanceKey(emp.id, year, month, day);
    const state = dayState(data.attendance[key]);
    let next: DayAttendance;
    if (state === 'blank') next = { present: true, absent: false, half: false, woff: false };
    else if (state === 'present') next = { present: false, absent: true, half: false, woff: false };
    else if (state === 'absent') next = { present: false, absent: false, half: true, woff: false };
    else if (state === 'half') next = { present: false, absent: false, half: false, woff: true };
    else next = defaultDayAttendance();
    void app.setAttendanceDay(emp.id, year, month, day, next).catch(() => undefined);
  };

  const cycleDatePart = (emp: Employee, part: { year: number; month: number; day: number }) => {
    const key = attendanceKey(emp.id, part.year, part.month, part.day);
    const state = dayState(data.attendance[key]);
    let next: DayAttendance;
    if (state === 'blank') next = { present: true, absent: false, half: false, woff: false };
    else if (state === 'present') next = { present: false, absent: true, half: false, woff: false };
    else if (state === 'absent') next = { present: false, absent: false, half: true, woff: false };
    else if (state === 'half') next = { present: false, absent: false, half: false, woff: true };
    else next = defaultDayAttendance();
    void app.setAttendanceDay(emp.id, part.year, part.month, part.day, next).catch(() => undefined);
  };

  const salaryRows = useMemo(
    () => filtered.map((e) => ({
      employee: e,
      breakdown: payCycleView === 'Weekly' ? calcEmployeeSalaryForDates(data, e, weekParts, getDecision(e.id)) : calcEmployeeSalary(data, e, year, month, getDecision(e.id)),
      attendance: payCycleView === 'Weekly' ? summarizeAttendanceForDates(data, e.id, weekParts) : summarizeAttendance(data, e.id, year, month),
    })),
    [filtered, data, year, month, payCycleView, weekParts, getDecision],
  );

  const salarySummary = salaryRows.reduce((acc, row) => ({
    gross: acc.gross + row.employee.grossSalary,
    deductions: acc.deductions + row.breakdown.totalDeductions,
    net: acc.net + row.breakdown.net,
  }), { gross: 0, deductions: 0, net: 0 });

  const outstandingTotal = data.employees.reduce((sum, e) => sum + outstandingAdvanceFor(data, e.id), 0);

  const openCreate = () => { setDraft({ ...emptyEmployee(), code: `EMP-${String(data.employees.length + 1).padStart(3, '0')}` }); setModalOpen(true); };
  const openEdit = (emp: Employee) => { setDraft(emp); setModalOpen(true); };
  const submitEmployee = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await app.upsertEmployee(draft);
      setModalOpen(false);
    } catch {
      // The shared sync banner displays the actionable save failure.
    }
  };
  const removeEmployee = (emp: Employee) => { if (confirm(`Remove ${emp.name}?`)) void app.upsertEmployee({ ...emp, status: 'Inactive' }).catch(() => undefined); };

  const submitAdvance = async (event: FormEvent) => {
    event.preventDefault();
    if (!advanceModal || advanceAmount <= 0 || !advanceDate) return;
    try {
      await app.addSalaryAdvance({ id: uid('adv'), employeeId: advanceModal.id, amount: advanceAmount, givenDate: advanceDate, note: advanceReason, cleared: false, createdAt: new Date().toISOString() });
      setAdvanceModal(null); setAdvanceAmount(0); setAdvanceDate(today()); setAdvanceReason('');
    } catch {
      // The shared sync banner displays the actionable save failure.
    }
  };

  const exportAttendance = () => {
    if (!filtered.length) return;
    const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char] ?? char));
    const dayColumns = Array.from({ length: total }, (_, index) => index + 1);
    const dayNames = dayColumns.map((day) => new Date(year, month - 1, day).toLocaleString('en-IN', { weekday: 'short' }));
    const rows = filtered.map((employee, index) => {
      const summary = summarizeAttendance(data, employee.id, year, month);
      const breakdown = calcEmployeeSalary(data, employee, year, month, getDecision(employee.id));
      const advanceList = data.salaryAdvances
        .filter((advance) => advance.employeeId === employee.id && !advance.cleared)
        .sort((a, b) => a.givenDate.localeCompare(b.givenDate));
      const advanceAmount = breakdown.advanceDeduction;
      const advanceDetails = advanceList.map((advance) => escapeHtml(`${advance.givenDate}: ₹${number(advance.amount)}${advance.note ? ` - ${advance.note}` : ''}`)).join('<br/>');
      return { employee, index, summary, breakdown, advanceAmount, advanceDetails };
    });
    const headerCells = dayColumns.map((day, index) => `<th class="${new Date(year, month - 1, day).getDay() === 0 ? 'sun' : ''}">${escapeHtml(dayNames[index])}<br/>${day}</th>`).join('');
    const bodyRows = rows.map(({ employee, index, summary, breakdown, advanceAmount, advanceDetails }) => {
      const attendanceCells = dayColumns.map((day) => {
        const state = dayState(data.attendance[attendanceKey(employee.id, year, month, day)]);
        return `<td class="mark ${state}">${escapeHtml(DAY_LABEL[state])}</td>`;
      }).join('');
      return `<tr><td>${index + 1}</td><td class="name">${escapeHtml(employee.name)}</td>${attendanceCells}<td>${summary.presentDays}</td><td>${summary.weekOffs}</td><td>${summary.halfDays}</td><td>${number(summary.workingDays, 1)}</td><td>${number(summary.payableDays, 1)}</td><td>${number(breakdown.perDay)}</td><td>${number(advanceAmount)}</td><td>${number(breakdown.net)}</td><td class="reason">${advanceDetails || '—'}</td></tr>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
      table{border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:11px}td,th{border:1px solid #333;padding:4px;text-align:center;vertical-align:middle}.title{font-size:16px;font-weight:700;color:#c00000}.address{font-size:12px;color:#1f4e79}.meta{font-weight:700;text-align:left}.name{text-align:left;font-weight:700;min-width:160px}.sun{background:#ff0000;color:#fff}.mark.present{color:#111}.mark.absent{background:#ff1a1a;color:#111}.mark.half{background:#fff2cc}.mark.leave{background:#ffe699}.reason{min-width:200px;text-align:left}.summary{background:#a9d18e;font-weight:700}.empty{border:none}
    </style></head><body><table><tr><td colspan="${total + 11}" class="title">${escapeHtml(data.settings.companyName)}</td></tr><tr><td colspan="${total + 11}" class="address">${escapeHtml(data.settings.address)}</td></tr><tr><td class="meta">Year</td><td class="meta">${year}</td><td colspan="${total + 9}" class="empty"></td></tr><tr><td class="meta">Month</td><td class="meta">${escapeHtml(label.split(' ')[0])}</td><td colspan="${total + 9}" class="empty"></td></tr><tr><th>S.No</th><th>Employee Name</th>${headerCells}<th class="summary">P</th><th class="summary">L</th><th class="summary">HD</th><th class="summary">Working Days</th><th class="summary">Days Payable</th><th class="summary">Per Day</th><th class="summary">Advance</th><th class="summary">Total</th><th class="summary">Advance Date / Reason</th></tr>${bodyRows}</table></body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-register-${year}-${String(month).padStart(2, '0')}.xls`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportSalary = () => downloadCsv(`salary-${year}-${month}.csv`, salaryRows.map(({ employee: e, breakdown: b, attendance }) => {
    const advances = data.salaryAdvances.filter((advance) => advance.employeeId === e.id && advance.givenDate.startsWith(`${year}-${String(month).padStart(2, '0')}`));
    return {
      Code: e.code, Name: e.name, Gross: e.grossSalary, WorkingDays: attendance.workingDays, PayableDays: attendance.payableDays,
      PerDay: b.perDay, Earned: b.earned, AdvanceDeducted: b.advanceDeduction, Other: b.otherDeduction, Net: b.net,
      AdvanceDates: advances.map((advance) => advance.givenDate).join(', '), AdvanceReasons: advances.map((advance) => advance.note ?? '').filter(Boolean).join(' | '),
    };
  }));

  const exportAdvances = () => downloadCsv(`salary-advances-${year}-${month}.csv`, data.salaryAdvances.map((advance) => {
    const employee = data.employees.find((candidate) => candidate.id === advance.employeeId);
    return { EmployeeCode: employee?.code ?? '', EmployeeName: employee?.name ?? 'Unknown', Amount: advance.amount, GivenDate: advance.givenDate, Reason: advance.note ?? '', Status: advance.cleared ? 'Cleared' : 'Outstanding' };
  }));

  const monthOptions = [0, -1, -2].map((offset) => { const d = new Date(year, month - 1 + offset, 1); return { year: d.getFullYear(), month: d.getMonth() + 1 }; });

  const deptChart = useMemo(() => departmentAnalytics(data, activeEmployees, year, month), [data, activeEmployees, year, month]);
  const branchChart = useMemo(() => branchAnalytics(data, activeEmployees), [data, activeEmployees]);
  const mix = useMemo(() => attendanceMixFor(data, activeEmployees, year, month), [data, activeEmployees, year, month]);
  const mixChart = [
    { name: 'Present', value: mix.present },
    { name: 'Half day', value: mix.half },
    { name: 'Leave', value: mix.weekOff },
    { name: 'Absent', value: mix.absent },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Payroll & workforce"
        title="Staff attendance & salary"
        description="Mark daily attendance, track advances, and compute monthly payroll for every branch."
        actions={(
          <>
            <div className="segmented">
              <button className={payCycleView === 'Monthly' ? 'active' : ''} onClick={() => setPayCycleView('Monthly')}>Monthly staff</button>
              <button className={payCycleView === 'Weekly' ? 'active' : ''} onClick={() => setPayCycleView('Weekly')}>Weekly staff</button>
            </div>
            {payCycleView === 'Monthly' ? (
              <select value={`${year}-${month}`} onChange={(e) => { const [y, m] = e.target.value.split('-').map(Number); setYM({ year: y, month: m }); }} className="month-select">
                {monthOptions.map((m) => <option key={`${m.year}-${m.month}`} value={`${m.year}-${m.month}`}>{monthLabel(m.year, m.month)}</option>)}
              </select>
            ) : (
              <div className="week-nav">
                <button type="button" className="icon-button" onClick={() => { const d = new Date(`${weekStart}T00:00:00`); d.setDate(d.getDate() - 7); setWeekStart(d.toISOString().slice(0, 10)); }}>‹</button>
                <strong>{weekLabel(weekStart)}</strong>
                <button type="button" className="icon-button" onClick={() => { const d = new Date(`${weekStart}T00:00:00`); d.setDate(d.getDate() + 7); setWeekStart(d.toISOString().slice(0, 10)); }}>›</button>
              </div>
            )}
            <button className="button primary" onClick={openCreate}><UserPlus size={17} /> Add employee</button>
          </>
        )}
      />

      <section className="stats-grid">
        <StatCard label="Active staff" value={String(activeEmployees.length)} helper={`${periodLabel} · ${payCycleView}`} icon={Users} />
        <StatCard label="Gross payroll" value={currency(salarySummary.gross)} helper="Sum of monthly gross salary" icon={CreditCard} tone="default" />
        <StatCard label="Net payable" value={currency(salarySummary.net)} helper="After deductions" icon={Check} tone="success" />
        <StatCard label="Outstanding advances" value={currency(outstandingTotal)} helper="Not yet cleared" icon={Ban} tone={outstandingTotal > 0 ? 'warning' : 'default'} />
      </section>

      <div className="report-tabs">
        {(['Attendance', 'Salary', 'Advances', 'Employees', 'Analytics'] as const).map((name) => (
          <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>
        ))}
      </div>

      {(tab === 'Attendance' || tab === 'Salary' || tab === 'Advances' || tab === 'Employees') && (
        <div className="table-toolbar panel">
          <SearchBar value={query} onChange={setQuery} placeholder="Search name, code or department..." />
          {tab === 'Attendance' && <button className="button secondary" onClick={exportAttendance}><Download size={17} /> Export register</button>}
          {tab === 'Salary' && <button className="button secondary" onClick={exportSalary}><Download size={17} /> Export salary</button>}
          {tab === 'Advances' && <button className="button secondary" onClick={exportAdvances}><Download size={17} /> Export advances</button>}
        </div>
      )}

      {tab === 'Attendance' && (
        <section className="panel table-panel">
          <div className="panel-header"><div><h2>Daily attendance — {periodLabel}</h2><span className="eyebrow">Tap a day to cycle Present → Absent → Half day → Leave → Blank</span></div></div>
          {filtered.length === 0 ? <EmptyState title="No employees found" description={payCycleView === 'Weekly' ? 'Add Mesthri, Electrician, Tile Worker, Painter or weekly Labor staff to record weekly attendance.' : 'Add staff to start recording attendance.'} action={<button className="button primary" onClick={openCreate}><UserPlus size={17} /> Add employee</button>} /> : payCycleView === 'Weekly' ? (
            <div className="table-scroll">
              <table className="data-table attendance-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    {weekParts.map((part) => <th key={`${part.year}-${part.month}-${part.day}`}>{new Date(part.year, part.month - 1, part.day).toLocaleDateString('en-IN', { weekday: 'short' })}<br />{part.day}</th>)}
                    <th>Payable days</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => {
                    const summary = summarizeAttendanceForDates(data, emp.id, weekParts);
                    return (
                      <Fragment key={emp.id}>
                        <tr>
                          <td><strong>{emp.name}</strong><span>{emp.code} · {emp.branch}</span></td>
                          {weekParts.map((part) => {
                            const state = dayState(data.attendance[attendanceKey(emp.id, part.year, part.month, part.day)]);
                            return (
                              <td key={`${part.year}-${part.month}-${part.day}`}>
                                <button type="button" className={`day-cell day-${state}`} onClick={() => cycleDatePart(emp, part)}>{DAY_LABEL[state]}</button>
                              </td>
                            );
                          })}
                          <td><strong>{number(summary.payableDays, 1)}</strong></td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table attendance-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    {Array.from({ length: total }, (_, i) => i + 1).map((d) => <th key={d}>{d}</th>)}
                    <th>Payable days</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp) => {
                    const summary = summarizeAttendance(data, emp.id, year, month);
                    return (
                      <Fragment key={emp.id}>
                        <tr>
                          <td><strong>{emp.name}</strong><span>{emp.code} · {emp.department}</span></td>
                          {Array.from({ length: total }, (_, i) => i + 1).map((d) => {
                            const state = dayState(data.attendance[attendanceKey(emp.id, year, month, d)]);
                            return (
                              <td key={d}>
                                <button type="button" className={`day-cell day-${state}`} onClick={() => cycleDay(emp, d)}>{DAY_LABEL[state]}</button>
                              </td>
                            );
                          })}
                          <td><strong>{number(summary.payableDays, 1)}</strong></td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'Salary' && (
        <section className="panel table-panel">
          <div className="panel-header"><div><h2>Payroll summary — {periodLabel}</h2><span className="eyebrow">Earned salary after attendance and advance deductions</span></div></div>
          {salaryRows.length === 0 ? <EmptyState title="No employees found" description="Add staff to compute payroll." /> : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>{payCycleView === 'Weekly' ? 'Weekly wage' : 'Gross (monthly)'}</th><th>Working days</th><th>Payable days</th><th>Earned</th><th>Advance</th><th>Other</th><th>Net payable</th><th>Deductions</th></tr></thead>
                <tbody>
                  {salaryRows.map(({ employee: e, breakdown: b, attendance }) => {
                    const decision = getDecision(e.id);
                    return (
                      <tr key={e.id}>
                        <td><strong>{e.name}</strong><span>{e.code} · {e.branch}</span></td>
                        <td>{currency(e.grossSalary)}</td>
                        <td>{number(attendance.workingDays, 1)}</td>
                        <td>{number(attendance.payableDays, 1)}</td>
                        <td><strong>{currency(b.earned)}</strong></td>
                        <td>
                          <label className="deduction-toggle"><input type="checkbox" checked={decision.deductAdvance} onChange={(ev) => void app.setDeductionDecision(e.id, periodKey, { ...decision, deductAdvance: ev.target.checked }).catch(() => undefined)} /> {currency(b.advanceDeduction)}</label>
                        </td>
                        <td>
                          <label className="deduction-toggle"><input type="checkbox" checked={decision.deductOther} onChange={(ev) => void app.setDeductionDecision(e.id, periodKey, { ...decision, deductOther: ev.target.checked }).catch(() => undefined)} /> {currency(b.otherDeduction)}</label>
                        </td>
                        <td><strong className="positive-text">{currency(b.net)}</strong></td>
                        <td className="negative-text">-{currency(b.totalDeductions)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr><td colSpan={7}>Total</td><td><strong>{currency(salarySummary.net)}</strong></td><td>{currency(salarySummary.deductions)}</td></tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'Advances' && (
        <section className="panel table-panel">
          <div className="panel-header">
            <div><h2>Salary advances</h2><span className="eyebrow">Track advances given to staff and mark them cleared once settled</span></div>
          </div>
          {data.employees.length === 0 ? <EmptyState title="No employees found" description="Add staff first to record an advance." /> : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Amount</th><th>Advance date</th><th>Reason</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {data.salaryAdvances.length === 0 && <tr><td colSpan={6}><EmptyState title="No advances recorded" description="Use the button below to record a salary advance." /></td></tr>}
                  {data.salaryAdvances.map((advance) => {
                    const emp = data.employees.find((e) => e.id === advance.employeeId);
                    return (
                      <tr key={advance.id}>
                        <td><strong>{emp?.name ?? 'Unknown'}</strong><span>{emp?.code}</span></td>
                        <td>{currency(advance.amount)}</td>
                        <td>{advance.givenDate}</td>
                        <td>{advance.note || '—'}</td>
                        <td><span className={`status-pill ${advance.cleared ? 'success' : 'warning'}`}>{advance.cleared ? 'Cleared' : 'Outstanding'}</span></td>
                        <td>{!advance.cleared && <button className="button secondary" onClick={() => void app.clearSalaryAdvance(advance.id).catch(() => undefined)}>Mark cleared</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="form-actions" style={{ padding: 15 }}>
            <select className="month-select" onChange={(e) => { const emp = data.employees.find((x) => x.id === e.target.value); if (emp) setAdvanceModal(emp); e.target.value = ''; }} defaultValue="">
              <option value="" disabled>Record advance for...</option>
              {activeEmployees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </section>
      )}

      {tab === 'Employees' && (
        <section className="panel table-panel">
          <div className="panel-header"><div><h2>Staff master</h2><span className="eyebrow">Employee salary structure and bank details</span></div></div>
          {allFiltered.length === 0 ? <EmptyState title="No employees found" description="Add your first employee." action={<button className="button primary" onClick={openCreate}><UserPlus size={17} /> Add employee</button>} /> : (
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Branch</th><th>Pay cycle</th><th>Department</th><th>Gross salary</th><th>Bank details</th><th>Outstanding advance</th><th /></tr></thead>
                <tbody>
                  {allFiltered.map((e) => (
                    <tr key={e.id}>
                      <td><strong>{e.name}</strong><span>{e.code}</span></td>
                      <td><span className="status-pill neutral">{e.branch}</span></td>
                      <td><span className={`soft-badge ${e.payCycle === 'Weekly' ? '' : 'warning-badge'}`}>{e.payCycle}</span></td>
                      <td>{e.department}</td>
                      <td><strong>{currency(e.grossSalary)}</strong><span>{e.payCycle === 'Weekly' ? 'per week' : 'per month'}</span></td>
                      <td>{e.bankName ? <>{e.bankName}<span>{e.accountNumber} · {e.ifscCode}</span></> : '—'}</td>
                      <td>{currency(outstandingAdvanceFor(data, e.id))}</td>
                      <td>
                        <div className="row-actions">
                          <button className="icon-button" onClick={() => openEdit(e)}><Pencil size={16} /></button>
                          <button className="icon-button danger" onClick={() => removeEmployee(e)}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === 'Analytics' && (
        <>
          <section className="dashboard-grid">
            <article className="panel chart-panel">
              <div className="panel-header">
                <div><span className="eyebrow">Attendance mix</span><h2>{label} attendance breakdown</h2></div>
                <span className="soft-badge">{activeEmployees.length} active staff</span>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={mixChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {mixChart.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="panel chart-panel">
              <div className="panel-header">
                <div><span className="eyebrow">Payroll</span><h2>Gross salary by branch</h2></div>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={branchChart} dataKey="gross" nameKey="branch" innerRadius={55} outerRadius={90} paddingAngle={2}>
                      {branchChart.map((entry, index) => <Cell key={entry.branch} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => currency(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </article>
          </section>

          <section className="panel chart-panel" style={{ height: 360 }}>
            <div className="panel-header">
              <div><span className="eyebrow">Department view</span><h2>Net payable & presence by department</h2></div>
              <TrendingUp size={18} />
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptChart} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="department" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} />
                  <Tooltip formatter={(value) => currency(Number(value))} />
                  <Legend />
                  <Bar dataKey="net" name="Net payable" radius={[8, 8, 0, 0]} fill={CHART_COLORS[0]} />
                  <Bar dataKey="gross" name="Gross salary" radius={[8, 8, 0, 0]} fill={CHART_COLORS[1]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="panel table-panel">
            <div className="panel-header"><div><h2>Department summary — {label}</h2></div></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Department</th><th>Employees</th><th>Gross</th><th>Net payable</th><th>Present days</th><th>Absent days</th></tr></thead>
                <tbody>
                  {deptChart.map((row) => (
                    <tr key={row.department}>
                      <td><strong>{row.department}</strong></td>
                      <td>{row.employees}</td>
                      <td>{currency(row.gross)}</td>
                      <td><strong>{currency(row.net)}</strong></td>
                      <td className="positive-text">{row.presentDays}</td>
                      <td className="negative-text">{row.absentDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <Modal open={modalOpen} title={data.employees.some((e) => e.id === draft.id) ? 'Edit employee' : 'Add employee'} subtitle="Salary structure used for attendance-based payroll calculation." onClose={() => setModalOpen(false)} wide>
        <form onSubmit={submitEmployee} className="form-stack">
          <div className="form-grid three">
            <label><span>Employee code *</span><input required value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></label>
            <label className="span-2"><span>Full name *</span><input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label><span>Branch</span><select value={draft.branch} onChange={(e) => setDraft({ ...draft, branch: e.target.value as StaffBranch })}>{branches.map((b) => <option key={b}>{b}</option>)}</select></label>
            <label><span>Department</span><input value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} placeholder="Site engineering, Stores..." /></label>
            <label><span>Pay cycle</span><select value={draft.payCycle} onChange={(e) => setDraft({ ...draft, payCycle: e.target.value as PayCycle })}><option>Weekly</option><option>Monthly</option></select></label>
            <label><span>{draft.payCycle === 'Weekly' ? 'Weekly wage *' : 'Gross salary (monthly) *'}</span><input type="number" min="0" required value={draft.grossSalary} onChange={(e) => setDraft({ ...draft, grossSalary: Number(e.target.value) })} /></label>
            <label><span>Other deduction</span><input type="number" min="0" value={draft.otherDeduction} onChange={(e) => setDraft({ ...draft, otherDeduction: Number(e.target.value) })} /></label>
            <label><span>Bank name</span><input value={draft.bankName ?? ''} onChange={(e) => setDraft({ ...draft, bankName: e.target.value })} /></label>
            <label><span>Account number</span><input value={draft.accountNumber ?? ''} onChange={(e) => setDraft({ ...draft, accountNumber: e.target.value })} /></label>
            <label><span>IFSC code</span><input value={draft.ifscCode ?? ''} onChange={(e) => setDraft({ ...draft, ifscCode: e.target.value })} /></label>
          </div>
          <div className="form-actions"><button type="button" className="button secondary" onClick={() => setModalOpen(false)}>Cancel</button><button className="button primary">Save employee</button></div>
        </form>
      </Modal>

      <Modal open={!!advanceModal} title={`Record advance — ${advanceModal?.name ?? ''}`} subtitle="Capture advance amount, taken date and reason. It remains outstanding until cleared." onClose={() => setAdvanceModal(null)}>
        <form onSubmit={submitAdvance} className="form-stack">
          <div className="form-grid two">
            <label><span>Amount *</span><input type="number" min="1" required value={advanceAmount || ''} onChange={(e) => setAdvanceAmount(Number(e.target.value))} /></label>
            <label><span>Advance taken date *</span><input type="date" required value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} /></label>
            <label className="span-2"><span>Reason</span><input value={advanceReason} onChange={(e) => setAdvanceReason(e.target.value)} placeholder="Reason / purpose for advance" /></label>
          </div>
          <div className="form-actions"><button type="button" className="button secondary" onClick={() => setAdvanceModal(null)}>Cancel</button><button className="button primary"><Plus size={16} /> Record advance</button></div>
        </form>
      </Modal>
    </div>
  );
}

import { Fragment, useCallback, useMemo, useState, type FormEvent } from 'react';
import { Ban, Calendar as CalendarIcon, Check, CreditCard, Download, Eye, Pencil, Plus, TrendingUp, Trash2, UserPlus, Users, UsersRound } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { EmptyState } from '../components/EmptyState';
import { Modal } from '../components/Modal';
import { NumberField } from '../components/NumberField';
import { PageHeader } from '../components/PageHeader';
import { SearchBar } from '../components/SearchBar';
import { StatCard } from '../components/StatCard';
import {
  attendanceKey, attendanceLeaderboard, attendanceMixFor, branchAnalytics, calcEmployeeSalary, calcEmployeeSalaryForDates, currency, daysInMonth,
  dateInputValue, dayAttendanceSummary, defaultDayAttendance, departmentAnalytics, downloadCsv, monthLabel, number, outstandingAdvanceFor,
  summarizeAttendance, summarizeAttendanceForDates, today, uid, weekDateParts, weekLabel,
} from '../lib/helpers';
import { employeeDepartment, employeeGroupAssignment, setEmployeeDepartment, setEmployeeGroup } from '../lib/employeeGroups';
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
const mondayIso = (date = new Date()) => { const day = date.getDay(); const diff = day === 0 ? -6 : 1 - day; const monday = new Date(date); monday.setDate(date.getDate() + diff); return dateInputValue(monday); };

function dayState(entry?: DayAttendance) {
  if (!entry) return 'blank';
  if (entry.present && entry.woff) return 'double';
  if (entry.present && entry.half) return 'one-half';
  if (entry.woff) return 'leave';
  if (entry.half) return 'half';
  if (entry.present) return 'present';
  if (entry.absent) return 'absent';
  return 'blank';
}

const DAY_LABEL: Record<string, string> = { blank: '', present: 'P', 'one-half': '1.5', double: '2', absent: 'A', half: 'HD', leave: 'L' };
const GROUP_ROLES = ['Supervisor', 'Skilled Worker', 'Assistant', 'Helper', 'Driver', 'Operator', 'Accountant', 'Member'];
type AttendanceTab = 'Attendance' | 'Salary' | 'Advances' | 'Employees' | 'Groups' | 'Analytics';
interface GroupDraft { originalName: string; name: string; headId: string; memberRoles: Record<string, string>; }

export function Attendance() {
  const app = useApp();
  const { data } = app;
  const [tab, setTab] = useState<AttendanceTab>('Attendance');
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
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [selectedGroupName, setSelectedGroupName] = useState<string | null>(null);
  const [groupDraft, setGroupDraft] = useState<GroupDraft>({ originalName: '', name: '', headId: '', memberRoles: {} });
  const [groupError, setGroupError] = useState('');

  const total = daysInMonth(year, month);
  const label = monthLabel(year, month);
  const weekParts = useMemo(() => weekDateParts(weekStart), [weekStart]);
  const periodLabel = payCycleView === 'Weekly' ? weekLabel(weekStart) : label;
  const periodKey = payCycleView === 'Weekly' ? `week-${weekStart}` : `month-${year}-${String(month).padStart(2, '0')}`;
  const activeEmployees = useMemo(() => data.employees.filter((e) => e.status === 'Active'), [data.employees]);
  const cycleEmployees = useMemo(() => activeEmployees.filter((e) => e.payCycle === payCycleView), [activeEmployees, payCycleView]);
  const filtered = useMemo(
    () => cycleEmployees.filter((e) => `${e.name} ${employeeDepartment(e)} ${employeeGroupAssignment(e)?.name ?? ''} ${e.code}`.toLowerCase().includes(query.toLowerCase())),
    [cycleEmployees, query],
  );
  const allFiltered = useMemo(
    () => activeEmployees.filter((e) => `${e.name} ${employeeDepartment(e)} ${employeeGroupAssignment(e)?.name ?? ''} ${e.code}`.toLowerCase().includes(query.toLowerCase())),
    [activeEmployees, query],
  );

  const getDecision = useCallback((employeeId: string): DeductionDecision => app.getDeductionDecision(employeeId, periodKey), [app, periodKey]);

  // Cycle order: Blank → Present → Absent → Half day → Blank.
  // Non-Labor staff can upgrade a present mark to 1.5× or 2× using the small controls.
  const nextAttendanceState = (state: string): DayAttendance => {
    if (state === 'blank') return { present: true, absent: false, half: false, woff: false };
    if (state === 'present' || state === 'one-half' || state === 'double') return { present: false, absent: true, half: false, woff: false };
    if (state === 'absent') return { present: false, absent: false, half: true, woff: false };
    return defaultDayAttendance();
  };

  const cycleDay = (emp: Employee, day: number) => {
    const key = attendanceKey(emp.id, year, month, day);
    const next = nextAttendanceState(dayState(data.attendance[key]));
    void app.setAttendanceDay(emp.id, year, month, day, next).catch(() => undefined);
  };

  const cycleDatePart = (emp: Employee, part: { year: number; month: number; day: number }) => {
    const key = attendanceKey(emp.id, part.year, part.month, part.day);
    const next = nextAttendanceState(dayState(data.attendance[key]));
    void app.setAttendanceDay(emp.id, part.year, part.month, part.day, next).catch(() => undefined);
  };

  const setWorkMultiplier = (emp: Employee, part: { year: number; month: number; day: number }, multiplier: 1.5 | 2) => {
    if (emp.branch === 'Labor') return;
    const value: DayAttendance = multiplier === 1.5
      ? { present: true, half: true, woff: false, absent: false }
      : { present: true, half: false, woff: true, absent: false };
    void app.setAttendanceDay(emp.id, part.year, part.month, part.day, value).catch(() => undefined);
  };

  const attendanceControl = (emp: Employee, part: { year: number; month: number; day: number }, onCycle: () => void) => {
    const state = dayState(data.attendance[attendanceKey(emp.id, part.year, part.month, part.day)]);
    const showMultiplier = emp.branch !== 'Labor' && ['present', 'one-half', 'double'].includes(state);
    return (
      <div className="day-cell-stack">
        <button type="button" className={`day-cell day-${state}`} onClick={onCycle}>{DAY_LABEL[state]}</button>
        {showMultiplier && (
          <div className="day-multiplier-actions">
            <button type="button" className={state === 'one-half' ? 'active' : ''} title="Count as 1.5 payable days" aria-label={`${emp.name}: count as 1.5 days`} onClick={() => setWorkMultiplier(emp, part, 1.5)}>1.5×</button>
            <button type="button" className={state === 'double' ? 'active' : ''} title="Count as 2 payable days" aria-label={`${emp.name}: count as 2 days`} onClick={() => setWorkMultiplier(emp, part, 2)}>2×</button>
          </div>
        )}
      </div>
    );
  };

  const salaryRows = useMemo(
    () => filtered.map((e) => ({
      employee: e,
      breakdown: payCycleView === 'Weekly' ? calcEmployeeSalaryForDates(data, e, weekParts, getDecision(e.id)) : calcEmployeeSalary(data, e, year, month, getDecision(e.id)),
      attendance: payCycleView === 'Weekly' ? summarizeAttendanceForDates(data, e.id, weekParts) : summarizeAttendance(data, e.id, year, month),
    })),
    [filtered, data, year, month, payCycleView, weekParts, getDecision],
  );

  const periodDays = payCycleView === 'Weekly' ? 7 : total;
  const salarySummary = salaryRows.reduce((acc, row) => ({
    gross: acc.gross + row.employee.grossSalary * periodDays,
    deductions: acc.deductions + row.breakdown.totalDeductions,
    net: acc.net + row.breakdown.net,
  }), { gross: 0, deductions: 0, net: 0 });

  const outstandingTotal = data.employees.reduce((sum, e) => sum + outstandingAdvanceFor(data, e.id), 0);

  const filteredAdvances = useMemo(
    () => data.salaryAdvances.filter((advance) => {
      const emp = data.employees.find((e) => e.id === advance.employeeId);
      return `${emp?.name ?? ''} ${emp?.code ?? ''}`.toLowerCase().includes(query.toLowerCase());
    }).sort((a, b) => b.givenDate.localeCompare(a.givenDate)),
    [data.salaryAdvances, data.employees, query],
  );

  const advanceByEmployee = useMemo(() => {
    const map = new Map<string, { employee: Employee | undefined; outstanding: typeof data.salaryAdvances; given: number }>();
    data.salaryAdvances.filter((a) => !a.cleared).forEach((advance) => {
      const current = map.get(advance.employeeId) ?? { employee: data.employees.find((e) => e.id === advance.employeeId), outstanding: [], given: 0 };
      current.outstanding = [...current.outstanding, advance];
      current.given += advance.amount;
      map.set(advance.employeeId, current);
    });
    return [...map.values()]
      .map((row) => ({ ...row, recovered: row.given - outstandingAdvanceFor(data, row.employee?.id ?? ''), remaining: outstandingAdvanceFor(data, row.employee?.id ?? '') }))
      .sort((a, b) => b.remaining - a.remaining);
  }, [data]);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; members: Array<{ employee: Employee; role: string; isHead: boolean }> }>();
    activeEmployees.forEach((employee) => {
      const assignment = employeeGroupAssignment(employee);
      if (!assignment) return;
      const key = assignment.name.toLowerCase();
      const group = map.get(key) ?? { name: assignment.name, members: [] };
      group.members.push({ employee, role: assignment.role, isHead: assignment.isHead });
      map.set(key, group);
    });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeEmployees]);
  const filteredGroups = useMemo(
    () => groups.filter((group) => `${group.name} ${group.members.map((member) => `${member.employee.name} ${member.role}`).join(' ')}`.toLowerCase().includes(query.toLowerCase())),
    [groups, query],
  );
  const selectedGroup = groups.find((group) => group.name === selectedGroupName) ?? null;
  const groupDetailDates = useMemo(
    () => payCycleView === 'Weekly'
      ? weekParts
      : Array.from({ length: total }, (_, index) => ({ year, month, day: index + 1 })),
    [payCycleView, weekParts, total, year, month],
  );
  const selectedGroupRows = useMemo(() => {
    if (!selectedGroup) return [];
    return selectedGroup.members
      .filter((member) => member.employee.payCycle === payCycleView)
      .map((member) => ({
        ...member,
        attendance: payCycleView === 'Weekly'
          ? summarizeAttendanceForDates(data, member.employee.id, weekParts)
          : summarizeAttendance(data, member.employee.id, year, month),
        salary: payCycleView === 'Weekly'
          ? calcEmployeeSalaryForDates(data, member.employee, weekParts, getDecision(member.employee.id))
          : calcEmployeeSalary(data, member.employee, year, month, getDecision(member.employee.id)),
        outstandingAdvance: outstandingAdvanceFor(data, member.employee.id),
      }))
      .sort((a, b) => Number(b.isHead) - Number(a.isHead)
        || (a.role || 'Unassigned').localeCompare(b.role || 'Unassigned')
        || a.employee.name.localeCompare(b.employee.name));
  }, [selectedGroup, payCycleView, data, weekParts, getDecision, year, month]);
  const selectedGroupTotals = selectedGroupRows.reduce((totals, row) => ({
    payableDays: totals.payableDays + row.attendance.payableDays,
    earned: totals.earned + row.salary.earned,
    advance: totals.advance + row.salary.advanceDeduction,
    outstandingAdvance: totals.outstandingAdvance + row.outstandingAdvance,
    deductions: totals.deductions + row.salary.totalDeductions,
    net: totals.net + row.salary.net,
  }), { payableDays: 0, earned: 0, advance: 0, outstandingAdvance: 0, deductions: 0, net: 0 });
  const selectedRoleTotals = useMemo(() => {
    const roleMap = new Map<string, { members: number; payableDays: number; net: number }>();
    selectedGroupRows.forEach((row) => {
      const role = row.isHead ? 'Group Head' : row.role || 'Role not assigned';
      const current = roleMap.get(role) ?? { members: 0, payableDays: 0, net: 0 };
      current.members += 1;
      current.payableDays += row.attendance.payableDays;
      current.net += row.salary.net;
      roleMap.set(role, current);
    });
    return [...roleMap.entries()].map(([role, totals]) => ({ role, ...totals }));
  }, [selectedGroupRows]);

  const openCreateGroup = () => {
    setGroupDraft({ originalName: '', name: '', headId: activeEmployees[0]?.id ?? '', memberRoles: {} });
    setGroupError('');
    setGroupModalOpen(true);
  };

  const openEditGroup = (name: string) => {
    const group = groups.find((candidate) => candidate.name === name);
    if (!group) return;
    const head = group.members.find((member) => member.isHead)?.employee ?? group.members[0]?.employee;
    setGroupDraft({
      originalName: group.name,
      name: group.name,
      headId: head?.id ?? '',
      memberRoles: Object.fromEntries(group.members.filter((member) => member.employee.id !== head?.id).map((member) => [member.employee.id, member.role])),
    });
    setGroupError('');
    setGroupModalOpen(true);
  };

  const submitGroup = async (event: FormEvent) => {
    event.preventDefault();
    const name = groupDraft.name.trim();
    if (!name || !groupDraft.headId) {
      setGroupError('Group name and group head are mandatory.');
      return;
    }
    if (groups.some((group) => group.name.toLowerCase() === name.toLowerCase() && group.name !== groupDraft.originalName)) {
      setGroupError('Another group already uses this name.');
      return;
    }
    const selected = new Map<string, { role: string; isHead: boolean }>([
      [groupDraft.headId, { role: 'Group Head', isHead: true }],
      ...Object.entries(groupDraft.memberRoles)
        .filter(([employeeId]) => employeeId !== groupDraft.headId)
        .map(([employeeId, role]) => [employeeId, { role: role.trim(), isHead: false }] as const),
    ]);
    try {
      for (const employee of activeEmployees) {
        const current = employeeGroupAssignment(employee);
        const selectedRole = selected.get(employee.id);
        const belongsToEditedGroup = current && (
          current.name.toLowerCase() === groupDraft.originalName.toLowerCase()
          || current.name.toLowerCase() === name.toLowerCase()
        );
        if (selectedRole) {
          await app.upsertEmployee(setEmployeeGroup(employee, { name, ...selectedRole }));
        } else if (belongsToEditedGroup) {
          await app.upsertEmployee(setEmployeeGroup(employee, null));
        }
      }
      setGroupModalOpen(false);
      setGroupError('');
    } catch {
      setGroupError('Some group assignments could not be saved. Review the sync message and try again.');
    }
  };

  const disbandGroup = async (name: string) => {
    if (!confirm(`Disband ${name}? Employees and their attendance records will remain available.`)) return;
    const members = activeEmployees.filter((employee) => employeeGroupAssignment(employee)?.name.toLowerCase() === name.toLowerCase());
    for (const employee of members) {
      await app.upsertEmployee(setEmployeeGroup(employee, null)).catch(() => undefined);
    }
  };

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
        const excelStyle = state === 'absent' ? ' style="background:#ff0000;color:#ffffff;font-weight:700"' : '';
        return `<td class="mark ${state}"${excelStyle}>${escapeHtml(DAY_LABEL[state])}</td>`;
      }).join('');
      return `<tr><td>${index + 1}</td><td class="name">${escapeHtml(employee.name)}</td>${attendanceCells}<td>${summary.presentDays}</td><td style="background:#ffe5e5;color:#c00000;font-weight:700">${summary.absentDays}</td><td>${summary.weekOffs}</td><td>${summary.halfDays}</td><td>${number(summary.workingDays, 1)}</td><td>${number(summary.payableDays, 1)}</td><td>${number(breakdown.perDay)}</td><td>${number(breakdown.earned)}</td><td>${number(advanceAmount)}</td><td>${number(breakdown.otherDeduction)}</td><td>${number(breakdown.totalDeductions)}</td><td>${number(breakdown.net)}</td><td class="reason">${advanceDetails || '—'}</td></tr>`;
    }).join('');
    const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
      table{border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:11px}td,th{border:1px solid #333;padding:4px;text-align:center;vertical-align:middle}.title{font-size:16px;font-weight:700;color:#c00000}.address{font-size:12px;color:#1f4e79}.meta{font-weight:700;text-align:left}.name{text-align:left;font-weight:700;min-width:160px}.sun{background:#ff0000;color:#fff}.mark.present{color:#111}.mark.one-half{background:#d9ead3;color:#1f6b35;font-weight:700}.mark.double{background:#cfe2f3;color:#174a72;font-weight:700}.mark.absent{background:#ff0000;color:#fff;font-weight:700}.mark.half{background:#fff2cc}.mark.leave{background:#ffe699}.reason{min-width:200px;text-align:left}.summary{background:#a9d18e;font-weight:700}.empty{border:none}
    </style></head><body><table><tr><td colspan="${total + 15}" class="title">${escapeHtml(data.settings.companyName)}</td></tr><tr><td colspan="${total + 15}" class="address">${escapeHtml(data.settings.address)}</td></tr><tr><td class="meta">Year</td><td class="meta">${year}</td><td colspan="${total + 13}" class="empty"></td></tr><tr><td class="meta">Month</td><td class="meta">${escapeHtml(label.split(' ')[0])}</td><td colspan="${total + 13}" class="empty"></td></tr><tr><th>S.No</th><th>Employee Name</th>${headerCells}<th class="summary">P</th><th class="summary" style="background:#ff0000;color:#ffffff;font-weight:700">A</th><th class="summary">L</th><th class="summary">HD</th><th class="summary">Working Days</th><th class="summary">Days Payable</th><th class="summary">Per Day</th><th class="summary">Earned</th><th class="summary">Advance Deduction</th><th class="summary">Other Deduction</th><th class="summary">Total Deductions</th><th class="summary">Net Payable</th><th class="summary">Advance Date / Reason</th></tr>${bodyRows}</table></body></html>`;
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
      PerDay: b.perDay, Earned: b.earned, AdvanceDeducted: b.advanceDeduction, OtherDeduction: b.otherDeduction, TotalDeductions: b.totalDeductions, NetPayable: b.net,
      AdvanceDates: advances.map((advance) => advance.givenDate).join(', '), AdvanceReasons: advances.map((advance) => advance.note ?? '').filter(Boolean).join(' | '),
    };
  }));

  const exportAdvances = () => downloadCsv(`salary-advances-${year}-${month}.csv`, data.salaryAdvances.map((advance) => {
    const employee = data.employees.find((candidate) => candidate.id === advance.employeeId);
    return { EmployeeCode: employee?.code ?? '', EmployeeName: employee?.name ?? 'Unknown', Amount: advance.amount, GivenDate: advance.givenDate, Reason: advance.note ?? '', Status: advance.cleared ? 'Cleared' : 'Outstanding' };
  }));

  const monthOptions = [0, -1, -2].map((offset) => { const d = new Date(year, month - 1 + offset, 1); return { year: d.getFullYear(), month: d.getMonth() + 1 }; });

  const deptChart = useMemo(() => departmentAnalytics(data, activeEmployees, year, month), [data, activeEmployees, year, month]);
  const branchChart = useMemo(() => branchAnalytics(data, activeEmployees, year, month), [data, activeEmployees, year, month]);
  const mix = useMemo(() => attendanceMixFor(data, activeEmployees, year, month), [data, activeEmployees, year, month]);
  const mixTotalMarks = mix.present + mix.half + mix.weekOff + mix.absent;
  const pct = (value: number) => (mixTotalMarks === 0 ? 0 : Math.round((value / mixTotalMarks) * 1000) / 10);
  const mixChart = [
    { name: 'Present', value: mix.present, pct: pct(mix.present) },
    { name: 'Half day', value: mix.half, pct: pct(mix.half) },
    { name: 'Leave', value: mix.weekOff, pct: pct(mix.weekOff) },
    { name: 'Absent', value: mix.absent, pct: pct(mix.absent) },
  ];
  const avgPresentPerEmployee = activeEmployees.length ? mix.present / activeEmployees.length : 0;
  const avgAbsentPerEmployee = activeEmployees.length ? mix.absent / activeEmployees.length : 0;

  const leaderboard = useMemo(() => attendanceLeaderboard(data, activeEmployees, year, month).slice(0, 6), [data, activeEmployees, year, month]);
  const leaderboardChart = leaderboard.map((row) => ({ name: row.employee.name, Present: row.summary.presentDays, Absent: row.summary.absentDays }));

  const calendarDays = Array.from({ length: total }, (_, index) => index + 1);
  const daySummary = useMemo(
    () => (selectedDay ? dayAttendanceSummary(data, activeEmployees, year, month, selectedDay) : null),
    [data, activeEmployees, year, month, selectedDay],
  );

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
                <button type="button" className="icon-button" onClick={() => { const d = new Date(`${weekStart}T00:00:00`); d.setDate(d.getDate() - 7); setWeekStart(dateInputValue(d)); }}>‹</button>
                <strong>{weekLabel(weekStart)}</strong>
                <button type="button" className="icon-button" onClick={() => { const d = new Date(`${weekStart}T00:00:00`); d.setDate(d.getDate() + 7); setWeekStart(dateInputValue(d)); }}>›</button>
              </div>
            )}
            <button className="button primary" onClick={openCreate}><UserPlus size={17} /> Add employee</button>
          </>
        )}
      />

      <section className="stats-grid">
        <StatCard label="Active staff" value={String(activeEmployees.length)} helper={`${periodLabel} · ${payCycleView}`} icon={Users} />
        <StatCard label="Gross payroll" value={currency(salarySummary.gross)} helper={`Per-day rate × ${payCycleView === 'Weekly' ? 'week' : total} days`} icon={CreditCard} tone="default" />
        <StatCard label="Net payable" value={currency(salarySummary.net)} helper="After deductions" icon={Check} tone="success" />
        <StatCard label="Outstanding advances" value={currency(outstandingTotal)} helper="Not yet cleared or recovered via payroll" icon={Ban} tone={outstandingTotal > 0 ? 'warning' : 'default'} />
      </section>

      <div className="report-tabs">
        {(['Attendance', 'Salary', 'Advances', 'Employees', 'Groups', 'Analytics'] as const).map((name) => (
          <button key={name} className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}</button>
        ))}
      </div>

      {(tab === 'Attendance' || tab === 'Salary' || tab === 'Advances' || tab === 'Employees' || tab === 'Groups') && (
        <div className="table-toolbar panel">
          <SearchBar value={query} onChange={setQuery} placeholder={tab === 'Groups' ? 'Search group, employee or role...' : 'Search name, code or department...'} />
          {tab === 'Attendance' && <button className="button secondary" onClick={exportAttendance}><Download size={17} /> Export register</button>}
          {tab === 'Salary' && <button className="button secondary" onClick={exportSalary}><Download size={17} /> Export salary</button>}
          {tab === 'Advances' && <button className="button secondary" onClick={exportAdvances}><Download size={17} /> Export advances</button>}
          {tab === 'Groups' && <button className="button primary" disabled={!activeEmployees.length} onClick={openCreateGroup}><UsersRound size={17} /> Create group</button>}
        </div>
      )}

      {tab === 'Attendance' && (
        <section className="panel table-panel">
          <div className="panel-header"><div><h2>Daily attendance — {periodLabel}</h2><span className="eyebrow">Tap to cycle P → A → HD → blank. For present non-Labor staff, use 1.5× or 2× for overtime work.</span></div></div>
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
                            return (
                              <td key={`${part.year}-${part.month}-${part.day}`}>
                                {attendanceControl(emp, part, () => cycleDatePart(emp, part))}
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
                          <td><strong>{emp.name}</strong><span>{emp.code} · {employeeDepartment(emp)}</span></td>
                          {Array.from({ length: total }, (_, i) => i + 1).map((d) => {
                            const part = { year, month, day: d };
                            return (
                              <td key={d}>
                                {attendanceControl(emp, part, () => cycleDay(emp, d))}
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
                <thead><tr><th>Employee</th><th>Gross (per day)</th><th>Working days</th><th>Payable days</th><th>Earned</th><th>Advance</th><th>Other</th><th>Net payable</th><th>Deductions</th></tr></thead>
                <tbody>
                  {salaryRows.map(({ employee: e, breakdown: b, attendance }) => {
                    const decision = getDecision(e.id);
                    return (
                      <tr key={e.id}>
                        <td><strong>{e.name}</strong><span>{e.code} · {e.branch}</span></td>
                        <td>{currency(e.grossSalary)}<span>per day</span></td>
                        <td>{number(attendance.workingDays, 1)}</td>
                        <td>{number(attendance.payableDays, 1)}</td>
                        <td><strong>{currency(b.earned)}</strong></td>
                        <td>
                          <label className="deduction-toggle" title="Tick to deduct from this outstanding advance for this period. Untick to give the amount back.">
                            <input
                              type="checkbox"
                              checked={decision.deductAdvance}
                              onChange={(ev) => {
                                const checked = ev.target.checked;
                                const available = outstandingAdvanceFor(data, e.id, periodKey);
                                const toDeduct = checked ? Math.min(available, b.earned) : 0;
                                void app.setDeductionDecision(e.id, periodKey, { ...decision, deductAdvance: checked, advanceDeducted: toDeduct }).catch(() => undefined);
                              }}
                            />
                            {currency(outstandingAdvanceFor(data, e.id, periodKey))}
                          </label>
                          {decision.deductAdvance && b.advanceDeduction > 0 && (
                            <span style={{ display: 'block', fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Deducting {currency(b.advanceDeduction)} this period</span>
                          )}
                          {outstandingAdvanceFor(data, e.id) > 0 && (
                            <button
                              type="button"
                              className="link-button"
                              style={{ display: 'block', marginTop: 4, fontSize: 11, fontWeight: 700 }}
                              onClick={() => {
                                if (!confirm(`Clear all outstanding advances for ${e.name} (${currency(outstandingAdvanceFor(data, e.id))})?`)) return;
                                const outstanding = data.salaryAdvances.filter((a) => a.employeeId === e.id && !a.cleared);
                                outstanding.forEach((advance) => void app.clearSalaryAdvance(advance.id).catch(() => undefined));
                              }}
                            >
                              Clear advance
                            </button>
                          )}
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
        <>
          {advanceByEmployee.length > 0 && (
            <section className="panel table-panel">
              <div className="panel-header"><div><h2>Outstanding by employee</h2><span className="eyebrow">Ticking "deduct advance" in the Salary tab actually recovers that amount here too — Clear all writes off whatever's still left</span></div></div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Employee</th><th>Advances given</th><th>Amount given</th><th>Recovered via payroll</th><th>Still outstanding</th><th /></tr></thead>
                  <tbody>
                    {advanceByEmployee.map(({ employee, outstanding, given, recovered, remaining }) => (
                      <tr key={employee?.id ?? 'unknown'}>
                        <td><strong>{employee?.name ?? 'Unknown'}</strong><span>{employee?.code}</span></td>
                        <td>{outstanding.length}</td>
                        <td>{currency(given)}</td>
                        <td className="positive-text">{recovered > 0 ? currency(recovered) : '—'}</td>
                        <td><strong className="negative-text">{currency(remaining)}</strong></td>
                        <td>
                          <button
                            className="button secondary"
                            disabled={remaining <= 0}
                            onClick={() => {
                              if (!confirm(`Clear all outstanding advances for ${employee?.name} (${currency(remaining)})?`)) return;
                              outstanding.forEach((advance) => void app.clearSalaryAdvance(advance.id).catch(() => undefined));
                            }}
                          >
                            Clear all
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="panel table-panel">
            <div className="panel-header">
              <div><h2>Salary advances</h2><span className="eyebrow">Track advances given to staff and mark them cleared once settled</span></div>
            </div>
            {data.employees.length === 0 ? <EmptyState title="No employees found" description="Add staff first to record an advance." /> : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead><tr><th>Employee</th><th>Amount</th><th>Advance date</th><th>Reason</th><th>Status</th><th /></tr></thead>
                  <tbody>
                    {filteredAdvances.length === 0 && <tr><td colSpan={6}><EmptyState title="No advances recorded" description="Use the button below to record a salary advance." /></td></tr>}
                    {filteredAdvances.map((advance) => {
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
        </>
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
                      <td>{employeeDepartment(e) || '—'}{employeeGroupAssignment(e) && <span>{employeeGroupAssignment(e)?.name} · {employeeGroupAssignment(e)?.role}</span>}</td>
                      <td><strong>{currency(e.grossSalary)}</strong><span>per day</span></td>
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

      {tab === 'Groups' && (
        <div className="page-stack">
          {filteredGroups.length === 0 ? (
            <section className="panel">
              <EmptyState
                title="No staff groups found"
                description="Create a group, choose its group head, add employees from the dropdown and assign each member a role."
                action={<button className="button primary" disabled={!activeEmployees.length} onClick={openCreateGroup}><UsersRound size={17} /> Create first group</button>}
              />
            </section>
          ) : filteredGroups.map((group) => {
            const members = group.members.filter((member) => member.employee.payCycle === payCycleView);
            const rows = members.map((member) => ({
              ...member,
              attendance: payCycleView === 'Weekly'
                ? summarizeAttendanceForDates(data, member.employee.id, weekParts)
                : summarizeAttendance(data, member.employee.id, year, month),
              salary: payCycleView === 'Weekly'
                ? calcEmployeeSalaryForDates(data, member.employee, weekParts, getDecision(member.employee.id))
                : calcEmployeeSalary(data, member.employee, year, month, getDecision(member.employee.id)),
            }));
            const payableDays = rows.reduce((sum, row) => sum + row.attendance.payableDays, 0);
            const netSalary = rows.reduce((sum, row) => sum + row.salary.net, 0);
            const head = group.members.find((member) => member.isHead);
            return (
              <section className="panel table-panel group-panel" key={group.name}>
                <div className="panel-header">
                  <div>
                    <span className="eyebrow">{group.members.length} total members · {members.length} {payCycleView.toLowerCase()} staff</span>
                    <h2>{group.name}</h2>
                    <p>Group head: <strong>{head?.employee.name ?? 'Not assigned'}</strong> · Payable days: <strong>{number(payableDays, 1)}</strong> · Net salary: <strong>{currency(netSalary)}</strong></p>
                  </div>
                  <div className="row-actions">
                    <button className="button secondary" onClick={() => setSelectedGroupName(group.name)}><Eye size={16} /> View details</button>
                    <button className="button secondary" onClick={() => openEditGroup(group.name)}><Pencil size={16} /> Manage</button>
                    <button className="icon-button danger" aria-label={`Disband ${group.name}`} onClick={() => void disbandGroup(group.name)}><Trash2 size={16} /></button>
                  </div>
                </div>
                {rows.length === 0 ? (
                  <div className="group-cycle-empty">No {payCycleView.toLowerCase()} employees in this group. Switch the payroll cycle above to view the other members.</div>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table">
                      <thead><tr><th>Employee</th><th>Group role</th><th>Branch</th><th>Present / weighted days</th><th>Absent</th><th>Half day</th><th>Payable days</th><th>Rate / day</th><th>Earned</th><th>Deductions</th><th>Net payable</th></tr></thead>
                      <tbody>{rows.map((row) => (
                        <tr key={row.employee.id}>
                          <td><strong>{row.employee.name}</strong><span>{row.employee.code} · {employeeDepartment(row.employee) || 'No department'}</span></td>
                          <td><span className={`status-pill ${row.isHead ? 'success' : 'neutral'}`}>{row.role || 'Not assigned'}</span></td>
                          <td>{row.employee.branch}</td>
                          <td className="positive-text">{number(row.attendance.presentDays, 1)}</td>
                          <td className="negative-text">{number(row.attendance.absentDays, 1)}</td>
                          <td>{number(row.attendance.halfDays, 1)}</td>
                          <td><strong>{number(row.attendance.payableDays, 1)}</strong></td>
                          <td>{currency(row.employee.grossSalary)}</td>
                          <td>{currency(row.salary.earned)}</td>
                          <td className="negative-text">-{currency(row.salary.totalDeductions)}</td>
                          <td><strong className="positive-text">{currency(row.salary.net)}</strong></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {tab === 'Analytics' && (
        <>
          <section className="stats-grid">
            <StatCard label="Avg present days / employee" value={number(avgPresentPerEmployee, 1)} helper={`${label} · out of ${total} days`} icon={Check} tone="success" />
            <StatCard label="Avg absent days / employee" value={number(avgAbsentPerEmployee, 1)} helper={`${label} · across ${activeEmployees.length} staff`} icon={Ban} tone={avgAbsentPerEmployee > 0 ? 'warning' : 'default'} />
            <StatCard label="Marked attendance" value={`${mixTotalMarks}`} helper="Total day-marks logged this month" icon={CalendarIcon} />
            <StatCard label="Active staff" value={String(activeEmployees.length)} helper="Currently active" icon={Users} />
          </section>

          <section className="dashboard-grid">
            <article className="panel chart-panel">
              <div className="panel-header">
                <div><span className="eyebrow">Attendance mix</span><h2>{label} attendance breakdown</h2></div>
                <span className="soft-badge">{activeEmployees.length} active staff · {mixTotalMarks} day-marks</span>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={mixChart} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} label={(entry: { name?: string; pct?: number }) => `${entry.name} ${entry.pct}%`}>
                      {mixChart.map((entry, index) => <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value, _name, item) => [`${value} days (${item?.payload?.pct ?? 0}%)`, item?.payload?.name]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <p style={{ padding: '0 20px 16px', margin: 0, fontSize: 11, color: 'var(--muted)' }}>
                Values are total employee-days for {label} — e.g. 2 staff present 20 days each shows as 40 present days. Use the "Avg present days" card above for a per-employee figure.
              </p>
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

          <section className="dashboard-grid">
            <article className="panel chart-panel" style={{ height: 340 }}>
              <div className="panel-header">
                <div><span className="eyebrow">Who to follow up with</span><h2>Present vs absent — top 6 by absence</h2></div>
              </div>
              <div className="chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={leaderboardChart} margin={{ top: 10, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Present" radius={[8, 8, 0, 0]} fill={CHART_COLORS[1]} />
                    <Bar dataKey="Absent" radius={[8, 8, 0, 0]} fill={CHART_COLORS[3]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <div><span className="eyebrow">{label}</span><h2>Attendance calendar</h2></div>
                <CalendarIcon size={18} />
              </div>
              <div style={{ padding: '4px 20px 20px' }}>
                <div className="attendance-calendar-grid">
                  {calendarDays.map((day) => {
                    const summary = dayAttendanceSummary(data, activeEmployees, year, month, day);
                    const weekday = new Date(year, month - 1, day).getDay();
                    return (
                      <button
                        type="button"
                        key={day}
                        className={`calendar-cell ${selectedDay === day ? 'selected' : ''} ${weekday === 0 ? 'sun' : ''}`}
                        onClick={() => setSelectedDay(day === selectedDay ? null : day)}
                        title={`${summary.present} present · ${summary.absent} absent · ${summary.half} half day`}
                      >
                        <span className="calendar-day-num">{day}</span>
                        <span className="calendar-day-dots">
                          {summary.present > 0 && <i className="dot dot-present" />}
                          {summary.absent > 0 && <i className="dot dot-absent" />}
                          {summary.half > 0 && <i className="dot dot-half" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {daySummary ? (
                  <div className="calendar-summary">
                    <strong>{monthLabel(year, month).split(' ')[0]} {selectedDay}, {year}</strong>
                    <div className="calendar-summary-grid">
                      <div><span className="positive-text">{daySummary.present}</span><small>Present</small></div>
                      <div><span className="negative-text">{daySummary.absent}</span><small>Absent</small></div>
                      <div><span>{daySummary.half}</span><small>Half day</small></div>
                      <div><span>{daySummary.blank}</span><small>Not marked</small></div>
                    </div>
                  </div>
                ) : (
                  <p style={{ marginTop: 14, fontSize: 11, color: 'var(--muted)' }}>Click a day to see how many staff were present, absent or on half day.</p>
                )}
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

          <section className="panel table-panel">
            <div className="panel-header"><div><h2>All employee details — {label}</h2><span className="eyebrow">Full staff roster with this period's attendance and pay</span></div></div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Branch</th><th>Department</th><th>Gross/day</th><th>Present</th><th>Absent</th><th>Half day</th><th>Net payable</th><th>Outstanding advance</th></tr></thead>
                <tbody>
                  {activeEmployees.map((emp) => {
                    const monthPeriodKey = `month-${year}-${String(month).padStart(2, '0')}`;
                    const summary = summarizeAttendance(data, emp.id, year, month);
                    const breakdown = calcEmployeeSalary(data, emp, year, month, app.getDeductionDecision(emp.id, monthPeriodKey));
                    return (
                      <tr key={emp.id}>
                        <td><strong>{emp.name}</strong><span>{emp.code}</span></td>
                        <td><span className="status-pill neutral">{emp.branch}</span></td>
                        <td>{employeeDepartment(emp) || '—'}</td>
                        <td>{currency(emp.grossSalary)}</td>
                        <td className="positive-text">{summary.presentDays}</td>
                        <td className="negative-text">{summary.absentDays}</td>
                        <td>{summary.halfDays}</td>
                        <td><strong>{currency(breakdown.net)}</strong></td>
                        <td>{currency(outstandingAdvanceFor(data, emp.id))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <Modal
        open={Boolean(selectedGroup)}
        title={selectedGroup?.name ?? 'Group details'}
        subtitle={`${periodLabel} attendance, payroll and role-wise totals`}
        onClose={() => setSelectedGroupName(null)}
        extraWide
      >
        {selectedGroup && (
          <div className="group-detail-sheet">
            <section className="group-detail-stats">
              <div><span>Group head</span><strong>{selectedGroup.members.find((member) => member.isHead)?.employee.name ?? 'Not assigned'}</strong></div>
              <div><span>Staff in cycle</span><strong>{selectedGroupRows.length}</strong></div>
              <div><span>Payable days</span><strong>{number(selectedGroupTotals.payableDays, 1)}</strong></div>
              <div><span>Earned salary</span><strong>{currency(selectedGroupTotals.earned)}</strong></div>
              <div><span>Total deductions</span><strong className="negative-text">{currency(selectedGroupTotals.deductions)}</strong></div>
              <div><span>Net payable</span><strong className="positive-text">{currency(selectedGroupTotals.net)}</strong></div>
            </section>

            {selectedGroupRows.length === 0 ? (
              <div className="group-cycle-empty">No {payCycleView.toLowerCase()} employees are assigned to this group.</div>
            ) : (
              <>
                <section className="group-attendance-sheet">
                  <div className="group-sheet-title">
                    <div><span className="eyebrow">{payCycleView} payroll sheet</span><h3>{selectedGroup.name}</h3></div>
                    <div><span>{periodLabel}</span><strong>{selectedGroupRows.length} members</strong></div>
                  </div>
                  <div className="table-scroll">
                    <table className="group-sheet-table">
                      <thead>
                        <tr>
                          <th className="sticky-name">Employee</th>
                          <th>Role</th>
                          {groupDetailDates.map((part) => {
                            const date = new Date(part.year, part.month - 1, part.day);
                            const sunday = date.getDay() === 0;
                            return <th className={sunday ? 'sunday-column' : ''} key={`${part.year}-${part.month}-${part.day}`}><strong>{part.day}</strong><span>{date.toLocaleDateString('en-IN', { weekday: 'short' })}</span></th>;
                          })}
                          <th>Present / weighted</th>
                          <th>Absent</th>
                          <th>Half day</th>
                          <th>Rate / day</th>
                          <th>Earned</th>
                          <th>Advance deducted</th>
                          <th>Other deduction</th>
                          <th>Net payable</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGroupRows.map((row) => (
                          <tr key={row.employee.id}>
                            <td className="sticky-name"><strong>{row.employee.name}</strong><span>{row.employee.code} · {row.employee.branch}</span></td>
                            <td><span className={`status-pill ${row.isHead ? 'success' : 'neutral'}`}>{row.isHead ? 'Group Head' : row.role || 'Not assigned'}</span></td>
                            {groupDetailDates.map((part) => {
                              const state = dayState(data.attendance[attendanceKey(row.employee.id, part.year, part.month, part.day)]);
                              return <td className={`group-day-value group-day-${state}`} key={`${row.employee.id}-${part.year}-${part.month}-${part.day}`}>{DAY_LABEL[state] || '—'}</td>;
                            })}
                            <td className="positive-text"><strong>{number(row.attendance.presentDays, 1)}</strong></td>
                            <td className="negative-text"><strong>{number(row.attendance.absentDays, 1)}</strong></td>
                            <td>{number(row.attendance.halfDays, 1)}</td>
                            <td>{currency(row.employee.grossSalary)}</td>
                            <td><strong>{currency(row.salary.earned)}</strong></td>
                            <td>{currency(row.salary.advanceDeduction)}</td>
                            <td>{currency(row.salary.otherDeduction)}</td>
                            <td className="positive-text"><strong>{currency(row.salary.net)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="sticky-name" colSpan={2 + groupDetailDates.length}>Group total</td>
                          <td>{number(selectedGroupTotals.payableDays, 1)}</td>
                          <td>—</td>
                          <td>—</td>
                          <td>—</td>
                          <td>{currency(selectedGroupTotals.earned)}</td>
                          <td>{currency(selectedGroupTotals.advance)}</td>
                          <td>{currency(selectedGroupTotals.deductions - selectedGroupTotals.advance)}</td>
                          <td className="positive-text">{currency(selectedGroupTotals.net)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </section>

                <section className="group-detail-bottom">
                  <div className="group-role-totals">
                    <div className="group-detail-heading"><span className="eyebrow">Role breakdown</span><h3>Team totals by role</h3></div>
                    {selectedRoleTotals.map((row) => (
                      <div className="group-role-total-row" key={row.role}>
                        <div><strong>{row.role}</strong><span>{row.members} member{row.members === 1 ? '' : 's'}</span></div>
                        <div><span>Days</span><strong>{number(row.payableDays, 1)}</strong></div>
                        <div><span>Net</span><strong>{currency(row.net)}</strong></div>
                      </div>
                    ))}
                  </div>
                  <div className="group-money-summary">
                    <div className="group-detail-heading"><span className="eyebrow">Payment overview</span><h3>Salary settlement</h3></div>
                    <div><span>Earned salary</span><strong>{currency(selectedGroupTotals.earned)}</strong></div>
                    <div><span>Advance deducted this period</span><strong>{currency(selectedGroupTotals.advance)}</strong></div>
                    <div><span>All deductions</span><strong>{currency(selectedGroupTotals.deductions)}</strong></div>
                    <div><span>Outstanding staff advances</span><strong>{currency(selectedGroupTotals.outstandingAdvance)}</strong></div>
                    <div className="group-money-net"><span>Net payable</span><strong>{currency(selectedGroupTotals.net)}</strong></div>
                  </div>
                </section>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal open={groupModalOpen} title={groupDraft.originalName ? `Manage ${groupDraft.originalName}` : 'Create staff group'} subtitle="Choose one group head, then add members. Member roles are optional and start blank." onClose={() => setGroupModalOpen(false)} wide>
        <form onSubmit={submitGroup} className="form-stack">
          {groupError && <div className="alert danger-alert">{groupError}</div>}
          <div className="form-grid two">
            <label><span>Group name *</span><input required value={groupDraft.name} onChange={(event) => setGroupDraft({ ...groupDraft, name: event.target.value })} placeholder="Example: Electrical Team A" /></label>
            <label><span>Group head *</span>
              <select required value={groupDraft.headId} onChange={(event) => {
                const memberRoles = { ...groupDraft.memberRoles };
                delete memberRoles[event.target.value];
                setGroupDraft({ ...groupDraft, headId: event.target.value, memberRoles });
              }}>
                <option value="">Select group head</option>
                {activeEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.code}{employeeGroupAssignment(employee) ? ` · ${employeeGroupAssignment(employee)?.name}` : ''}</option>)}
              </select>
            </label>
            <label className="span-2"><span>Add employee from dropdown</span>
              <select value="" onChange={(event) => {
                const employeeId = event.target.value;
                if (!employeeId) return;
                setGroupDraft({ ...groupDraft, memberRoles: { ...groupDraft.memberRoles, [employeeId]: '' } });
              }}>
                <option value="">Choose employee to add...</option>
                {activeEmployees.filter((employee) => employee.id !== groupDraft.headId && !groupDraft.memberRoles[employee.id]).map((employee) => <option key={employee.id} value={employee.id}>{employee.name} · {employee.code} · {employee.branch}{employeeGroupAssignment(employee) ? ` · currently ${employeeGroupAssignment(employee)?.name}` : ''}</option>)}
              </select>
              <small>Employees already in another group can be reassigned here. Attendance and salary history remains with the employee.</small>
            </label>
          </div>
          <div className="group-member-editor">
            <div className="group-member-heading"><strong>Selected members</strong><span>{Object.keys(groupDraft.memberRoles).length} employees, plus the group head</span></div>
            {Object.keys(groupDraft.memberRoles).length === 0 ? <div className="group-cycle-empty">Add employees using the dropdown above. A group can also start with only its head.</div> : (
              Object.entries(groupDraft.memberRoles).map(([employeeId, role]) => {
                const employee = activeEmployees.find((candidate) => candidate.id === employeeId);
                if (!employee) return null;
                return (
                  <div className="group-member-row" key={employeeId}>
                    <div><strong>{employee.name}</strong><span>{employee.code} · {employee.branch} · {employeeDepartment(employee) || 'No department'}</span></div>
                    <label><span>Role (optional)</span><select value={role} onChange={(event) => setGroupDraft({ ...groupDraft, memberRoles: { ...groupDraft.memberRoles, [employeeId]: event.target.value } })}><option value="">Select role</option>{GROUP_ROLES.map((item) => <option key={item}>{item}</option>)}</select></label>
                    <button type="button" className="icon-button danger" aria-label={`Remove ${employee.name} from group`} onClick={() => {
                      const memberRoles = { ...groupDraft.memberRoles };
                      delete memberRoles[employeeId];
                      setGroupDraft({ ...groupDraft, memberRoles });
                    }}><Trash2 size={16} /></button>
                  </div>
                );
              })
            )}
          </div>
          <div className="form-actions"><button type="button" className="button secondary" onClick={() => setGroupModalOpen(false)}>Cancel</button><button className="button primary"><UsersRound size={16} /> Save group</button></div>
        </form>
      </Modal>

      <Modal open={modalOpen} title={data.employees.some((e) => e.id === draft.id) ? 'Edit employee' : 'Add employee'} subtitle="Salary structure used for attendance-based payroll calculation." onClose={() => setModalOpen(false)} wide>
        <form onSubmit={submitEmployee} className="form-stack">
          <div className="form-grid three">
            <label><span>Employee code *</span><input required value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} /></label>
            <label className="span-2"><span>Full name *</span><input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label><span>Branch</span><select value={draft.branch} onChange={(e) => setDraft({ ...draft, branch: e.target.value as StaffBranch })}>{branches.map((b) => <option key={b}>{b}</option>)}</select></label>
            <label><span>Department</span><input value={employeeDepartment(draft)} onChange={(e) => setDraft(setEmployeeDepartment(draft, e.target.value))} placeholder="Site engineering, Stores..." /></label>
            <label><span>Pay cycle</span><select value={draft.payCycle} onChange={(e) => setDraft({ ...draft, payCycle: e.target.value as PayCycle })}><option>Weekly</option><option>Monthly</option></select></label>
            <label><span>Gross salary (per day) *</span><NumberField required value={draft.grossSalary} onChange={(value) => setDraft({ ...draft, grossSalary: value ?? 0 })} min="0" step="0.01" /></label>
            <label><span>Other deduction</span><NumberField value={draft.otherDeduction} onChange={(value) => setDraft({ ...draft, otherDeduction: value ?? 0 })} min="0" /></label>
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
            <label><span>Amount *</span><NumberField required value={advanceAmount || undefined} onChange={(value) => setAdvanceAmount(value ?? 0)} min="1" /></label>
            <label><span>Advance taken date *</span><input type="date" required value={advanceDate} onChange={(e) => setAdvanceDate(e.target.value)} /></label>
            <label className="span-2"><span>Reason</span><input value={advanceReason} onChange={(e) => setAdvanceReason(e.target.value)} placeholder="Reason / purpose for advance" /></label>
          </div>
          <div className="form-actions"><button type="button" className="button secondary" onClick={() => setAdvanceModal(null)}>Cancel</button><button className="button primary"><Plus size={16} /> Record advance</button></div>
        </form>
      </Modal>
    </div>
  );
}

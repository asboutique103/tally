import type { Employee } from '../types';

const GROUP_MARKER = '\n[[VMV_GROUP:';
const GROUP_SUFFIX = ']]';

export interface EmployeeGroupAssignment {
  name: string;
  role: string;
  isHead: boolean;
}

const splitDepartment = (value: unknown) => {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value);
  const markerIndex = text.lastIndexOf(GROUP_MARKER);
  if (markerIndex < 0 || !text.endsWith(GROUP_SUFFIX)) return { department: text.trim(), assignment: null as EmployeeGroupAssignment | null };
  const encoded = text.slice(markerIndex + GROUP_MARKER.length, -GROUP_SUFFIX.length);
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as Partial<EmployeeGroupAssignment>;
    if (!parsed.name || !parsed.role) throw new Error('Invalid group assignment');
    return {
      department: text.slice(0, markerIndex).trim(),
      assignment: { name: String(parsed.name), role: String(parsed.role), isHead: Boolean(parsed.isHead) },
    };
  } catch {
    return { department: text.trim(), assignment: null as EmployeeGroupAssignment | null };
  }
};

export const employeeDepartment = (employee: Employee) => splitDepartment(employee.department).department;

export const employeeGroupAssignment = (employee: Employee) => splitDepartment(employee.department).assignment;

export const setEmployeeDepartment = (employee: Employee, department: string): Employee => {
  const assignment = employeeGroupAssignment(employee);
  return setEmployeeGroup({ ...employee, department: department.trim() }, assignment);
};

export const setEmployeeGroup = (employee: Employee, assignment: EmployeeGroupAssignment | null): Employee => {
  const department = employeeDepartment(employee);
  if (!assignment) return { ...employee, department };
  const normalized = {
    name: assignment.name.trim(),
    role: assignment.role.trim(),
    isHead: assignment.isHead,
  };
  return {
    ...employee,
    department: `${department}${GROUP_MARKER}${encodeURIComponent(JSON.stringify(normalized))}${GROUP_SUFFIX}`,
  };
};

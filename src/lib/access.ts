import type { Role } from '../types';

export const ALL_ROLES: Role[] = ['Owner', 'Admin', 'Accountant', 'Storekeeper', 'Site Engineer', 'Viewer'];
export const OWNER_ADMIN: Role[] = ['Owner', 'Admin'];
export const ACCOUNTING_ROLES: Role[] = ['Owner', 'Admin', 'Accountant'];
export const STORE_ROLES: Role[] = ['Owner', 'Admin', 'Storekeeper'];
export const SITE_STORE_ROLES: Role[] = ['Owner', 'Admin', 'Storekeeper', 'Site Engineer'];

export const ROUTE_ACCESS: Record<string, Role[]> = {
  '/': ALL_ROLES,
  '/materials': STORE_ROLES,
  '/receipts': STORE_ROLES,
  '/supplies': SITE_STORE_ROLES,
  '/suppliers': ACCOUNTING_ROLES,
  '/stock-ledger': ['Owner', 'Admin', 'Accountant', 'Storekeeper', 'Viewer'],
  '/sites': ['Owner', 'Admin', 'Site Engineer'],
  '/bills': ACCOUNTING_ROLES,
  '/payments': ACCOUNTING_ROLES,
  '/accounts': ACCOUNTING_ROLES,
  '/attendance': OWNER_ADMIN,
  '/reports': ['Owner', 'Admin', 'Accountant', 'Storekeeper', 'Site Engineer', 'Viewer'],
  '/audit': OWNER_ADMIN,
  '/settings': OWNER_ADMIN,
};

export const canRoleAccess = (role: Role | null, path: string) => {
  if (!role) return false;
  return (ROUTE_ACCESS[path] ?? []).includes(role);
};

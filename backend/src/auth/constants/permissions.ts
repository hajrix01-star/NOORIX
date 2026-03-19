/**
 * صلاحيات Noorix — ما لا تملك صلاحية عليه لا تراه.
 */

export const PERMISSIONS = {
  // ─── عرض الأقسام (Sidebar) ───────────────────────────────────
  VIEW_OWNER:       'VIEW_OWNER',
  VIEW_DASHBOARD:   'VIEW_DASHBOARD',
  VIEW_CHAT:        'VIEW_CHAT',
  VIEW_SALES:       'VIEW_SALES',
  VIEW_INVOICES:    'VIEW_INVOICES',
  VIEW_SUPPLIERS:   'VIEW_SUPPLIERS',
  VIEW_VAULTS:      'VIEW_VAULTS',
  VIEW_REPORTS:     'VIEW_REPORTS',

  // ─── فواتير ───────────────────────────────────────────────────
  INVOICES_READ:    'INVOICES_READ',
  INVOICES_WRITE:   'INVOICES_WRITE',
  INVOICES_DELETE:  'INVOICES_DELETE',
  INVOICES_ACTIONS: 'INVOICES_ACTIONS',  // طباعة، تعديل، حذف

  // ─── مبيعات ───────────────────────────────────────────────────
  SALES_READ:       'SALES_READ',
  SALES_WRITE:      'SALES_WRITE',
  SALES_DELETE:     'SALES_DELETE',
  SALES_ACTIONS:    'SALES_ACTIONS',     // طباعة، تعديل، حذف

  // ─── موردين ───────────────────────────────────────────────────
  SUPPLIERS_READ:   'SUPPLIERS_READ',
  SUPPLIERS_WRITE:  'SUPPLIERS_WRITE',
  SUPPLIERS_DELETE: 'SUPPLIERS_DELETE',

  // ─── خزائن ────────────────────────────────────────────────────
  VAULTS_READ:      'VAULTS_READ',
  VAULTS_WRITE:     'VAULTS_WRITE',
  VAULTS_DELETE:    'VAULTS_DELETE',

  // ─── تقارير ───────────────────────────────────────────────────
  REPORTS_READ:     'REPORTS_READ',

  // ─── المحادثة الذكية ───────────────────────────────────────────
  SMART_CHAT_READ:  'SMART_CHAT_READ',   // تنفيذ الاستعلامات في المحادثة الذكية

  // ─── إدارة النظام ─────────────────────────────────────────────
  MANAGE_SETTINGS:  'MANAGE_SETTINGS',
  MANAGE_COMPANIES: 'MANAGE_COMPANIES',
  MANAGE_USERS:     'MANAGE_USERS',

  // ─── حذف (عمليات خطرة) ────────────────────────────────────────
  DELETE_COMPANY:   'DELETE_COMPANY',
  USERS_DELETE:     'USERS_DELETE',

  // ─── موظفون (HR) ─────────────────────────────────────────────
  VIEW_EMPLOYEES:   'VIEW_EMPLOYEES',
  EMPLOYEES_READ:   'EMPLOYEES_READ',
  EMPLOYEES_WRITE:  'EMPLOYEES_WRITE',
  EMPLOYEES_DELETE: 'EMPLOYEES_DELETE',

  // ─── HR (رواتب، إجازات، إقامات، مستندات، حركات، بدلات، خصومات) ─
  HR_READ:          'HR_READ',
  HR_WRITE:         'HR_WRITE',
  HR_DELETE:        'HR_DELETE',

  // ─── قديم (للتوافق) ───────────────────────────────────────────
  CREATE_INVOICE:   'CREATE_INVOICE',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  OWNER:       'owner',
  ACCOUNTANT:  'accountant',
  CASHIER:     'cashier',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

const ALL = Object.values(PERMISSIONS);

/** صلاحيات كل دور */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  [ROLES.SUPER_ADMIN]: ALL,
  [ROLES.OWNER]:       ALL,
  [ROLES.ACCOUNTANT]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CHAT,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.VIEW_SUPPLIERS,
    PERMISSIONS.VIEW_VAULTS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.VIEW_EMPLOYEES,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_WRITE,
    PERMISSIONS.INVOICES_ACTIONS,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.SALES_ACTIONS,
    PERMISSIONS.SUPPLIERS_READ,
    PERMISSIONS.VAULTS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.EMPLOYEES_READ,
    PERMISSIONS.EMPLOYEES_WRITE,
    PERMISSIONS.HR_READ,
    PERMISSIONS.HR_WRITE,
    PERMISSIONS.HR_DELETE,
    PERMISSIONS.SMART_CHAT_READ,
    PERMISSIONS.CREATE_INVOICE,
  ],
  [ROLES.CASHIER]: [
    PERMISSIONS.VIEW_CHAT,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.VIEW_VAULTS,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.SALES_ACTIONS,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_WRITE,
    PERMISSIONS.INVOICES_ACTIONS,
    PERMISSIONS.VAULTS_READ,
    PERMISSIONS.SMART_CHAT_READ,
    PERMISSIONS.CREATE_INVOICE,
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const r = (role || '').toLowerCase();
  if (r === ROLES.SUPER_ADMIN || r === ROLES.OWNER) return true;
  const perms = ROLE_PERMISSIONS[r];
  return Array.isArray(perms) && perms.includes(permission);
}

export function isSuperAdmin(role: string): boolean {
  const r = (role || '').toLowerCase();
  return r === ROLES.SUPER_ADMIN || r === ROLES.OWNER;
}

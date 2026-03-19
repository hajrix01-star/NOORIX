/**
 * صلاحيات Noorix — مطابقة للـ Backend. ما لا تملك صلاحية عليه لا تراه.
 */
export const PERMISSIONS = {
  // ─── عرض الأقسام (Sidebar) ─────────────────────────────────
  VIEW_OWNER:       'VIEW_OWNER',
  VIEW_DASHBOARD:   'VIEW_DASHBOARD',
  VIEW_CHAT:        'VIEW_CHAT',
  VIEW_SALES:       'VIEW_SALES',
  VIEW_INVOICES:    'VIEW_INVOICES',
  VIEW_SUPPLIERS:   'VIEW_SUPPLIERS',
  VIEW_VAULTS:      'VIEW_VAULTS',
  VIEW_REPORTS:     'VIEW_REPORTS',

  // ─── فواتير ────────────────────────────────────────────────
  INVOICES_READ:    'INVOICES_READ',
  INVOICES_WRITE:   'INVOICES_WRITE',
  INVOICES_DELETE:  'INVOICES_DELETE',
  INVOICES_ACTIONS: 'INVOICES_ACTIONS',  // طباعة، تعديل، حذف — للمالك

  // ─── مبيعات ────────────────────────────────────────────────
  SALES_READ:       'SALES_READ',
  SALES_WRITE:      'SALES_WRITE',
  SALES_DELETE:     'SALES_DELETE',
  SALES_ACTIONS:    'SALES_ACTIONS',     // طباعة، تعديل، حذف — للمالك

  // ─── موردين ────────────────────────────────────────────────
  SUPPLIERS_READ:   'SUPPLIERS_READ',
  SUPPLIERS_WRITE:  'SUPPLIERS_WRITE',
  SUPPLIERS_DELETE: 'SUPPLIERS_DELETE',

  // ─── خزائن ─────────────────────────────────────────────────
  VAULTS_READ:      'VAULTS_READ',
  VAULTS_WRITE:     'VAULTS_WRITE',
  VAULTS_DELETE:    'VAULTS_DELETE',

  // ─── موظفون / موارد بشرية ───────────────────────────────────
  EMPLOYEES_READ:   'EMPLOYEES_READ',
  EMPLOYEES_WRITE:  'EMPLOYEES_WRITE',

  // ─── تقارير ────────────────────────────────────────────────
  REPORTS_READ:     'REPORTS_READ',

  // ─── المحادثة الذكية ────────────────────────────────────────
  SMART_CHAT_READ:  'SMART_CHAT_READ',

  // ─── إدارة النظام ──────────────────────────────────────────
  MANAGE_SETTINGS:  'MANAGE_SETTINGS',
  MANAGE_COMPANIES: 'MANAGE_COMPANIES',
  MANAGE_USERS:     'MANAGE_USERS',

  // ─── حذف (عمليات خطرة) ─────────────────────────────────────
  DELETE_COMPANY:   'DELETE_COMPANY',
  USERS_DELETE:     'USERS_DELETE',

  // ─── قديم (للتوافق) ────────────────────────────────────────
  CREATE_INVOICE:   'CREATE_INVOICE',
};

const ALL = Object.values(PERMISSIONS);

/** صلاحيات كل دور */
const ROLE_PERMISSIONS = {
  super_admin: ALL,
  owner:       ALL,
  accountant: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CHAT,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.VIEW_SUPPLIERS,
    PERMISSIONS.VIEW_VAULTS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.VIEW_SALES,
    PERMISSIONS.INVOICES_READ,
    PERMISSIONS.INVOICES_WRITE,
    PERMISSIONS.INVOICES_ACTIONS,
    PERMISSIONS.SALES_READ,
    PERMISSIONS.SALES_WRITE,
    PERMISSIONS.SALES_ACTIONS,
    PERMISSIONS.SUPPLIERS_READ,
    PERMISSIONS.VAULTS_READ,
    PERMISSIONS.EMPLOYEES_READ,
    PERMISSIONS.EMPLOYEES_WRITE,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.CREATE_INVOICE,
  ],
  cashier: [
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

export function hasPermission(role, permission) {
  const r = (role || '').toLowerCase();
  if (r === 'super_admin' || r === 'owner') return true;
  const perms = ROLE_PERMISSIONS[r];
  return Array.isArray(perms) && perms.includes(permission);
}

export function isSuperAdmin(role) {
  const r = (role || '').toLowerCase();
  return r === 'super_admin' || r === 'owner';
}

/** مسارات الصفحات الحقيقية → صلاحية مطلوبة */
export const ROUTE_PERMISSION = {
  '/owner':         PERMISSIONS.VIEW_OWNER,
  '/chat':          PERMISSIONS.VIEW_CHAT,
  '/sales/new':     PERMISSIONS.VIEW_SALES,
  '/invoices':      PERMISSIONS.VIEW_INVOICES,
  '/suppliers':     PERMISSIONS.VIEW_SUPPLIERS,
  '/treasury':      PERMISSIONS.VIEW_VAULTS,
  '/hr':            PERMISSIONS.EMPLOYEES_READ,
  '/reports':       PERMISSIONS.VIEW_REPORTS,
  '/settings':      PERMISSIONS.MANAGE_SETTINGS,
  '/theme-preview': PERMISSIONS.VIEW_DASHBOARD,
};

/** المسارات التي تُعيد التوجيه فقط — لا تحتاج فحص صلاحية */
export const REDIRECT_ONLY_PATHS = new Set([
  '/', '/expenses', '/orders', '/purchasing', '/hr', '/403',
]);

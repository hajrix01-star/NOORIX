/**
 * Noorix Permissions — Frontend.
 *
 * ✅ مصدر الحقيقة الوحيد = Backend (/roles/permissions-schema).
 * ✅ هذا الملف يحتوي فقط على: PERMISSIONS strings + hasPermission + routing.
 * ✅ لا يوجد PERMISSION_MODULES أو SYSTEM_ROLE_PERMISSIONS — تُجلب من API.
 */

import { getAuthToken } from '../services/authStore';

export const PERMISSIONS = {
  VIEW_OWNER:       'VIEW_OWNER',
  VIEW_DASHBOARD:   'VIEW_DASHBOARD',
  VIEW_CHAT:        'VIEW_CHAT',
  VIEW_SALES:       'VIEW_SALES',
  VIEW_INVOICES:    'VIEW_INVOICES',
  VIEW_PURCHASES:   'VIEW_PURCHASES',
  VIEW_SUPPLIERS:   'VIEW_SUPPLIERS',
  VIEW_VAULTS:      'VIEW_VAULTS',
  VIEW_REPORTS:     'VIEW_REPORTS',
  VIEW_EMPLOYEES:   'VIEW_EMPLOYEES',
  VIEW_ORDERS:      'VIEW_ORDERS',
  VIEW_EXPENSES:    'VIEW_EXPENSES',
  VIEW_ASSETS:      'VIEW_ASSETS',

  INVOICES_READ:    'INVOICES_READ',
  INVOICES_WRITE:   'INVOICES_WRITE',
  INVOICES_DELETE:  'INVOICES_DELETE',
  INVOICES_ACTIONS: 'INVOICES_ACTIONS',
  INVOICES_VIEW_EXEC_SUMMARY: 'INVOICES_VIEW_EXEC_SUMMARY',

  PURCHASES_READ:   'PURCHASES_READ',
  PURCHASES_WRITE:  'PURCHASES_WRITE',
  PURCHASES_DELETE: 'PURCHASES_DELETE',

  SALES_READ:       'SALES_READ',
  SALES_WRITE:      'SALES_WRITE',
  SALES_DELETE:     'SALES_DELETE',
  SALES_ACTIONS:    'SALES_ACTIONS',
  SALES_FULL_HISTORY:        'SALES_FULL_HISTORY',
  SALES_VIEW_SUMMARIES_LIST: 'SALES_VIEW_SUMMARIES_LIST',

  SUPPLIERS_READ:   'SUPPLIERS_READ',
  SUPPLIERS_WRITE:  'SUPPLIERS_WRITE',
  SUPPLIERS_DELETE: 'SUPPLIERS_DELETE',

  VAULTS_READ:      'VAULTS_READ',
  VAULTS_WRITE:     'VAULTS_WRITE',
  VAULTS_DELETE:    'VAULTS_DELETE',

  EXPENSES_READ:    'EXPENSES_READ',
  EXPENSES_WRITE:   'EXPENSES_WRITE',
  EXPENSES_DELETE:  'EXPENSES_DELETE',

  ASSETS_READ:      'ASSETS_READ',
  ASSETS_WRITE:     'ASSETS_WRITE',
  ASSETS_DELETE:    'ASSETS_DELETE',

  ORDERS_READ:      'ORDERS_READ',
  ORDERS_WRITE:     'ORDERS_WRITE',
  ORDERS_DELETE:    'ORDERS_DELETE',

  REPORTS_READ:     'REPORTS_READ',
  VIEW_REPORTS_GENERAL:      'VIEW_REPORTS_GENERAL',
  VIEW_REPORTS_COST_APPS:    'VIEW_REPORTS_COST_APPS',
  VIEW_REPORTS_TAX:          'VIEW_REPORTS_TAX',
  VIEW_REPORTS_BANK:         'VIEW_REPORTS_BANK',

  VIEW_HAJRI_TAX:   'VIEW_HAJRI_TAX',
  HAJRI_TAX_READ:   'HAJRI_TAX_READ',
  HAJRI_TAX_WRITE:  'HAJRI_TAX_WRITE',

  VIEW_HR:          'VIEW_HR',

  SMART_CHAT_READ:  'SMART_CHAT_READ',

  CHAT_PRESET_ADVANCES:   'CHAT_PRESET_ADVANCES',
  CHAT_PRESET_LEAVES:     'CHAT_PRESET_LEAVES',
  CHAT_PRESET_DEDUCTIONS: 'CHAT_PRESET_DEDUCTIONS',
  CHAT_PRESET_FAQ:        'CHAT_PRESET_FAQ',
  CHAT_PRESET_INCREASES:  'CHAT_PRESET_INCREASES',
  CHAT_PRESET_ADD_EMPLOYEE: 'CHAT_PRESET_ADD_EMPLOYEE',
  CHAT_PRESET_EXPENSE_ADD:  'CHAT_PRESET_EXPENSE_ADD',
  CHAT_PRESET_EXPENSE_PAY:  'CHAT_PRESET_EXPENSE_PAY',
  CHAT_PRESET_EXPENSE_EDIT: 'CHAT_PRESET_EXPENSE_EDIT',

  CHAT_FAQ_ANNUAL_SALES:   'CHAT_FAQ_ANNUAL_SALES',
  CHAT_FAQ_VAULT_BALANCES: 'CHAT_FAQ_VAULT_BALANCES',
  CHAT_FAQ_PNL_SUMMARY:    'CHAT_FAQ_PNL_SUMMARY',
  CHAT_FAQ_LOAD_VS_SALES:  'CHAT_FAQ_LOAD_VS_SALES',
  CHAT_FAQ_SALES_COMPARE:  'CHAT_FAQ_SALES_COMPARE',
  CHAT_FAQ_INVOICE_COUNT:  'CHAT_FAQ_INVOICE_COUNT',
  CHAT_FAQ_SUPPLIER_COUNT: 'CHAT_FAQ_SUPPLIER_COUNT',
  CHAT_FAQ_EMPLOYEE_COUNT: 'CHAT_FAQ_EMPLOYEE_COUNT',
  CHAT_FAQ_HELP:           'CHAT_FAQ_HELP',

  EMPLOYEES_READ:   'EMPLOYEES_READ',
  EMPLOYEES_WRITE:  'EMPLOYEES_WRITE',
  EMPLOYEES_DELETE: 'EMPLOYEES_DELETE',

  HR_READ:          'HR_READ',
  HR_WRITE:         'HR_WRITE',
  HR_DELETE:        'HR_DELETE',

  MANAGE_SETTINGS:  'MANAGE_SETTINGS',
  MANAGE_COMPANIES: 'MANAGE_COMPANIES',
  MANAGE_USERS:     'MANAGE_USERS',

  DELETE_COMPANY:   'DELETE_COMPANY',
  USERS_DELETE:     'USERS_DELETE',

  CREATE_INVOICE:   'CREATE_INVOICE',

  VIEW_OCR:   'VIEW_OCR',
  OCR_READ:   'OCR_READ',
  OCR_WRITE:  'OCR_WRITE',
  OCR_SUBMIT: 'OCR_SUBMIT',

  STAFF_ORDERS_SUBMIT: 'STAFF_ORDERS_SUBMIT',
  STAFF_ORDERS_DIGEST: 'STAFF_ORDERS_DIGEST',
};

/**
 * hasPermission — يتحقق من صلاحيات DB فقط (لا fallback).
 * الأدوار النظامية تُزرع في DB عند أول تشغيل — لا حاجة لـ hardcoded defaults.
 */
export function hasPermission(roleOrPermissions: any, permission: any, userPermissions: any) {
  if (Array.isArray(roleOrPermissions)) {
    return roleOrPermissions.includes(permission);
  }

  const role = (roleOrPermissions || '').toLowerCase();
  if (role === 'super_admin' || role === 'owner') return true;

  if (!Array.isArray(userPermissions)) return false;
  return userPermissions.includes(permission);
}

/** أي صلاحية من القائمة (منطق OR) — للقائمة الجانبية ومسارات متعددة المداخل */
export function hasAnyOfPermissions(userRole: any, required: readonly string[], userPermissions: any): boolean {
  if (!required.length) return false;
  return required.some((p) => hasPermission(userRole, p, userPermissions));
}

export function isSuperAdmin(role: any) {
  const r = (role || '').toLowerCase();
  return r === 'super_admin' || r === 'owner';
}

/** حذف مسيرة رواتب — المالك، المشرف العام، أو دور manager (مخصّص) */
export function canDeletePayrollRunRole(role: any) {
  const r = (role || '').toLowerCase();
  return r === 'owner' || r === 'super_admin' || r === 'manager';
}

/** يقرأ حقل role من JWT عند غيابه في كائن المستخدم (سياق /me لم يكتمل بعد). */
function decodeJwtRole() {
  const token = getAuthToken();
  if (!token || typeof token !== 'string') return '';
  const parts = token.split('.');
  if (parts.length < 2) return '';
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const json = JSON.parse(atob(b64 + pad));
    return String(json.role || '').toLowerCase();
  } catch {
    return '';
  }
}

/** دور المستخدم للعرض: السياق أولاً ثم JWT. */
export function resolveUserRole(primary: any) {
  const p = String(primary || '').toLowerCase();
  if (p) return p;
  return decodeJwtRole();
}

/** دخول شاشة HR/الموظفين: قائمة الموظفين أو أي صلاحية تشغيل في وحدة الموارد البشرية */
export const HR_APP_ACCESS = [
  PERMISSIONS.VIEW_HR,
  PERMISSIONS.VIEW_EMPLOYEES,
  PERMISSIONS.HR_READ,
  PERMISSIONS.HR_WRITE,
  PERMISSIONS.HR_DELETE,
];

/** دخول قسم التقارير (الأب أو أي تبويب فرعي) */
export const REPORTS_APP_ACCESS = [
  PERMISSIONS.VIEW_REPORTS,
  PERMISSIONS.REPORTS_READ,
  PERMISSIONS.VIEW_REPORTS_GENERAL,
  PERMISSIONS.VIEW_REPORTS_COST_APPS,
  PERMISSIONS.VIEW_REPORTS_TAX,
  PERMISSIONS.VIEW_REPORTS_BANK,
];

/** تقرير عام — مع fallback لصلاحية التقارير القديمة */
export const REPORTS_GENERAL_ACCESS = [PERMISSIONS.VIEW_REPORTS_GENERAL, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.REPORTS_READ];
export const REPORTS_COST_APPS_ACCESS = [PERMISSIONS.VIEW_REPORTS_COST_APPS, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.REPORTS_READ];
export const REPORTS_TAX_ACCESS = [PERMISSIONS.VIEW_REPORTS_TAX, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.REPORTS_READ];
export const REPORTS_BANK_ACCESS = [PERMISSIONS.VIEW_REPORTS_BANK, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.REPORTS_READ];

/** دخول قسم الطلبات — مدير أو موظف Staff Orders */
export const ORDERS_APP_ACCESS = [
  PERMISSIONS.VIEW_ORDERS,
  PERMISSIONS.STAFF_ORDERS_SUBMIT,
  PERMISSIONS.STAFF_ORDERS_DIGEST,
];

/** تبويبات التقارير — ترتيب redirect الافتراضي */
export const REPORT_TAB_SEQUENCE: Array<{ path: string; required: readonly string[] }> = [
  { path: '/reports/general', required: REPORTS_GENERAL_ACCESS },
  { path: '/reports/cost-apps', required: REPORTS_COST_APPS_ACCESS },
  { path: '/reports/tax', required: REPORTS_TAX_ACCESS },
  { path: '/reports/bank-statement', required: REPORTS_BANK_ACCESS },
];

export function getFirstAccessibleReportPath(userRole: any, userPermissions: any): string {
  if (isSuperAdmin(userRole)) return '/reports/general';
  for (const { path, required } of REPORT_TAB_SEQUENCE) {
    if (hasAnyOfPermissions(userRole, required, userPermissions)) return path;
  }
  return '/403';
}

/** HAJRI TAX — مع fallback لتقارير قديمة */
export const HAJRI_TAX_APP_ACCESS = [PERMISSIONS.VIEW_HAJRI_TAX, PERMISSIONS.HAJRI_TAX_READ, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.REPORTS_READ];

/** سجل الأصول — مع fallback لمصروفات قديمة */
export const ASSETS_APP_ACCESS = [PERMISSIONS.VIEW_ASSETS, PERMISSIONS.ASSETS_READ, PERMISSIONS.VIEW_EXPENSES, PERMISSIONS.EXPENSES_READ];

/** دخول الإعدادات: إدارة عامة أو مستخدمين أو شركات */
export const SETTINGS_APP_ACCESS = [
  PERMISSIONS.MANAGE_SETTINGS,
  PERMISSIONS.MANAGE_USERS,
  PERMISSIONS.MANAGE_COMPANIES,
];

/** فواتير المبيعات: مسار واحد يخدم عارضي المبيعات أو المشتريات */
export const INVOICES_ROUTE_ACCESS = [PERMISSIONS.VIEW_INVOICES, PERMISSIONS.VIEW_PURCHASES];

/** مسارات الصفحات → صلاحية مطلوبة */
export const ROUTE_PERMISSION = {
  '/':              PERMISSIONS.VIEW_DASHBOARD,
  '/owner':         PERMISSIONS.VIEW_OWNER,
  '/chat':          PERMISSIONS.VIEW_CHAT,
  '/sales':         PERMISSIONS.VIEW_SALES,
  '/sales/new':     PERMISSIONS.VIEW_SALES,
  '/invoices':      INVOICES_ROUTE_ACCESS,
  '/purchases':     PERMISSIONS.VIEW_PURCHASES,
  '/suppliers':     PERMISSIONS.VIEW_SUPPLIERS,
  '/treasury':      PERMISSIONS.VIEW_VAULTS,
  '/expenses':      PERMISSIONS.VIEW_EXPENSES,
  '/assets':        ASSETS_APP_ACCESS,
  '/orders':        ORDERS_APP_ACCESS,
  '/hr':            HR_APP_ACCESS,
  '/reports':       REPORTS_APP_ACCESS,
  '/reports/general': REPORTS_GENERAL_ACCESS,
  '/reports/cost-apps': REPORTS_COST_APPS_ACCESS,
  '/reports/tax':   REPORTS_TAX_ACCESS,
  '/reports/bank-statement': REPORTS_BANK_ACCESS,
  '/hajri-tax':     HAJRI_TAX_APP_ACCESS,
  '/settings':      SETTINGS_APP_ACCESS,
  '/theme-preview':    PERMISSIONS.VIEW_DASHBOARD,
  '/ocr':           PERMISSIONS.VIEW_OCR,
  '/ocr/cashier':   PERMISSIONS.OCR_SUBMIT,
};

export const REDIRECT_ONLY_PATHS = new Set([
  '/purchasing',
  '/403',
]);

export function getRouteRequiredPermissions(pathname: any) {
  if (REDIRECT_ONLY_PATHS.has(pathname)) return null;
  const direct = (ROUTE_PERMISSION as Record<string, string | string[] | undefined>)[String(pathname)];
  if (direct != null) {
    return Array.isArray(direct) ? direct : [direct];
  }
  if (pathname.startsWith('/hr/')) {
    const hr = ROUTE_PERMISSION['/hr'];
    return Array.isArray(hr) ? [...hr] : [hr];
  }
  if (pathname.startsWith('/purchases')) {
    return [PERMISSIONS.VIEW_PURCHASES];
  }
  if (pathname.startsWith('/reports/')) {
    const sub = (ROUTE_PERMISSION as Record<string, string | string[] | undefined>)[pathname];
    if (sub != null) {
      return Array.isArray(sub) ? sub : [sub];
    }
    return [...REPORTS_APP_ACCESS];
  }
  if (pathname.startsWith('/hajri-tax')) {
    return [...HAJRI_TAX_APP_ACCESS];
  }
  return null;
}

/**
 * إن وُجدت أي صلاحية داخل قسم يملك مفتاح `view` في المصفوفة، يُضاف تلقائياً عرض الصفحة (VIEW_*)
 * حتى تتطابق القائمة الجانبية مع اختيار «القسم» (مثلاً ORDERS_READ بدون VIEW_ORDERS كان يخفي الطلبات).
 */
export function normalizeModuleViewAccess(
  modules: Array<{ permissions?: Record<string, string> }> | undefined,
  perms: string[],
): string[] {
  if (!Array.isArray(modules) || !modules.length) return [...perms];
  const set = new Set(perms);
  for (const mod of modules) {
    const pmap = mod.permissions || {};
    const viewPerm = pmap.view;
    if (!viewPerm) continue;
    const hasAnyNonView = Object.entries(pmap).some(([k, p]) => k !== 'view' && set.has(p));
    if (hasAnyNonView) set.add(viewPerm);
  }
  return Array.from(set);
}

/** أول مسار يملك المستخدم صلاحية دخوله — بعد تسجيل الدخول أو زر «عودة» من 403/404 */
const APP_HOME_ROUTE_SEQUENCE: Array<{ path: string; required: string | string[] }> = [
  { path: '/sales', required: PERMISSIONS.VIEW_SALES },
  { path: '/orders', required: ORDERS_APP_ACCESS },
  { path: '/settings', required: [...SETTINGS_APP_ACCESS] },
  { path: '/hr', required: [...HR_APP_ACCESS] },
  { path: '/', required: PERMISSIONS.VIEW_DASHBOARD },
  { path: '/purchases', required: PERMISSIONS.VIEW_PURCHASES },
  { path: '/invoices', required: INVOICES_ROUTE_ACCESS },
  { path: '/treasury', required: PERMISSIONS.VIEW_VAULTS },
  { path: '/expenses', required: PERMISSIONS.VIEW_EXPENSES },
  { path: '/assets', required: ASSETS_APP_ACCESS },
  { path: '/suppliers', required: PERMISSIONS.VIEW_SUPPLIERS },
  { path: '/reports/general', required: REPORTS_GENERAL_ACCESS },
  { path: '/reports/cost-apps', required: REPORTS_COST_APPS_ACCESS },
  { path: '/reports/tax', required: REPORTS_TAX_ACCESS },
  { path: '/reports/bank-statement', required: REPORTS_BANK_ACCESS },
  { path: '/hajri-tax', required: HAJRI_TAX_APP_ACCESS },
  { path: '/chat', required: PERMISSIONS.VIEW_CHAT },
  { path: '/ocr', required: PERMISSIONS.VIEW_OCR },
  { path: '/ocr/cashier', required: PERMISSIONS.OCR_SUBMIT },
  { path: '/owner', required: PERMISSIONS.VIEW_OWNER },
];

export function getFirstAccessibleAppPath(userRole: any, userPermissions: any): string {
  if (isSuperAdmin(userRole)) return '/';
  for (const { path, required } of APP_HOME_ROUTE_SEQUENCE) {
    const list = Array.isArray(required) ? required : [required];
    if (list.some((perm) => hasPermission(userRole, perm, userPermissions))) return path;
  }
  return '/';
}

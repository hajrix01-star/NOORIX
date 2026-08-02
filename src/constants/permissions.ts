/**
 * Noorix Permissions — Frontend.
 *
 * ✅ مصدر الحقيقة الوحيد = Backend (/roles/permissions-schema).
 * ✅ هذا الملف يحتوي فقط على: PERMISSIONS strings + hasPermission + routing.
 * ✅ لا يوجد PERMISSION_MODULES أو SYSTEM_ROLE_PERMISSIONS — تُجلب من API.
 */

import { PERMISSIONS } from '@noorix/permissions-core';
import type { Permission } from '@noorix/permissions-core';
import { getAuthToken } from '../services/authStore';

export { PERMISSIONS };
export type { Permission };

/**
 * hasPermission — يتحقق من صلاحيات DB فقط (لا fallback).
 * الأدوار النظامية تُزرع في DB عند أول تشغيل — لا حاجة لـ hardcoded defaults.
 */
export function hasPermission(roleOrPermissions: unknown, permission: unknown, userPermissions: unknown) {
  if (Array.isArray(roleOrPermissions)) {
    return roleOrPermissions.includes(permission);
  }

  const role = String(roleOrPermissions || '').toLowerCase();
  if (role === 'super_admin' || role === 'owner') return true;

  if (!Array.isArray(userPermissions)) return false;
  return userPermissions.includes(permission);
}

/** أي صلاحية من القائمة (منطق OR) — للقائمة الجانبية ومسارات متعددة المداخل */
export function hasAnyOfPermissions(userRole: unknown, required: readonly string[], userPermissions: unknown): boolean {
  if (!required.length) return false;
  return required.some((p) => hasPermission(userRole, p, userPermissions));
}

export function isSuperAdmin(role: unknown) {
  const r = String(role || '').toLowerCase();
  return r === 'super_admin' || r === 'owner';
}

/** حذف مسيرة رواتب — المالك، المشرف العام، أو دور manager (مخصّص) */
export function canDeletePayrollRunRole(role: unknown) {
  const r = String(role || '').toLowerCase();
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
export function resolveUserRole(primary: unknown) {
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
  PERMISSIONS.HR_LEAVE_SALARY_OVERRIDE,
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
  PERMISSIONS.VIEW_INTERNAL_REGISTRATION,
  PERMISSIONS.ORDERS_STAFF_SUBMIT,
  PERMISSIONS.STAFF_ORDERS_READ,
  PERMISSIONS.STAFF_ORDERS_SUBMIT,
];

/** جلب بيانات الطلبات — واجهة المدير الكاملة */
export const ORDERS_MANAGER_DATA_ACCESS = [
  PERMISSIONS.ORDERS_READ,
  PERMISSIONS.ORDERS_WRITE,
] as const;

export const ORDERS_STAFF_SUBMIT_ACCESS = [PERMISSIONS.ORDERS_STAFF_SUBMIT] as const;

/** التسجيل الداخلي — مستقل عن إدارة الطلبات */
export const ORDERS_INTERNAL_REGISTRATION_ACCESS = [
  PERMISSIONS.STAFF_ORDERS_READ,
  PERMISSIONS.STAFF_ORDERS_SUBMIT,
] as const;

/** تقرير التسجيل الداخلي — قراءة مستقلة عن الطلبات */
export const ORDERS_SALES_REPORT_ACCESS = [PERMISSIONS.STAFF_ORDERS_READ] as const;

/** طلبات V4 — نطاق مستقل بالكامل عن الطلبات القديمة. */
export const ORDERS_V4_APP_ACCESS: string[] = [
  PERMISSIONS.VIEW_ORDERS_V4,
  PERMISSIONS.ORDERS_V4_READ,
  PERMISSIONS.ORDERS_V4_WRITE,
  PERMISSIONS.ORDERS_V4_STAFF_SUBMIT,
  PERMISSIONS.ORDERS_V4_INTERNAL_SUBMIT,
  PERMISSIONS.ORDERS_V4_CASHIER_RECEIVE,
  PERMISSIONS.ORDERS_V4_REPORTS_READ,
  PERMISSIONS.ORDERS_V4_INVENTORY_WRITE,
];

/** تبويبات التقارير — ترتيب redirect الافتراضي */
export const REPORT_TAB_SEQUENCE: Array<{ path: string; required: readonly string[] }> = [
  { path: '/reports/general', required: REPORTS_GENERAL_ACCESS },
  { path: '/reports/cost-apps', required: REPORTS_COST_APPS_ACCESS },
  { path: '/reports/tax', required: REPORTS_TAX_ACCESS },
  { path: '/reports/bank-statement', required: REPORTS_BANK_ACCESS },
];

export function getFirstAccessibleReportPath(userRole: unknown, userPermissions: unknown): string {
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
  PERMISSIONS.MANAGE_TAX_SETTINGS,
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
  '/orders-v4':     ORDERS_V4_APP_ACCESS,
  '/hr':            HR_APP_ACCESS,
  '/reports':       REPORTS_APP_ACCESS,
  '/reports/general': REPORTS_GENERAL_ACCESS,
  '/reports/cost-apps': REPORTS_COST_APPS_ACCESS,
  '/reports/tax':   REPORTS_TAX_ACCESS,
  '/reports/bank-statement': REPORTS_BANK_ACCESS,
  '/hajri-tax':     HAJRI_TAX_APP_ACCESS,
  '/settings':      SETTINGS_APP_ACCESS,
  '/theme-preview':    PERMISSIONS.VIEW_DASHBOARD,
};

export const REDIRECT_ONLY_PATHS = new Set([
  '/purchasing',
  '/403',
]);

export function getRouteRequiredPermissions(pathname: unknown) {
  const path = String(pathname);
  if (REDIRECT_ONLY_PATHS.has(path)) return null;
  const direct = (ROUTE_PERMISSION as Record<string, string | string[] | undefined>)[path];
  if (direct != null) {
    return Array.isArray(direct) ? direct : [direct];
  }
  if (path.startsWith('/hr/')) {
    const hr = ROUTE_PERMISSION['/hr'];
    return Array.isArray(hr) ? [...hr] : [hr];
  }
  if (path.startsWith('/purchases')) {
    return [PERMISSIONS.VIEW_PURCHASES];
  }
  if (path.startsWith('/reports/')) {
    const sub = (ROUTE_PERMISSION as Record<string, string | string[] | undefined>)[path];
    if (sub != null) {
      return Array.isArray(sub) ? sub : [sub];
    }
    return [...REPORTS_APP_ACCESS];
  }
  if (path.startsWith('/hajri-tax')) {
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
  { path: '/orders-v4', required: ORDERS_V4_APP_ACCESS },
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
  { path: '/owner', required: PERMISSIONS.VIEW_OWNER },
];

export function getFirstAccessibleAppPath(userRole: unknown, userPermissions: unknown): string {
  if (isSuperAdmin(userRole)) return '/';
  for (const { path, required } of APP_HOME_ROUTE_SEQUENCE) {
    const list = Array.isArray(required) ? required : [required];
    if (list.some((perm) => hasPermission(userRole, perm, userPermissions))) return path;
  }
  return '/';
}

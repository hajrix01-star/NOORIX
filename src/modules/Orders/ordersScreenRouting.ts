import {
  ORDERS_MANAGER_DATA_ACCESS,
  ORDERS_SALES_REPORT_ACCESS,
  PERMISSIONS,
  hasAnyOfPermissions,
} from '../../constants/permissions';

export type OrdersScreenMode = 'staff' | 'manager-full' | 'forbidden';

export function resolveOrdersScreenMode(
  userRole: unknown,
  userPermissions: unknown,
): {
  mode: OrdersScreenMode;
  canSubmitStaff: boolean;
  hasManagerDataAccess: boolean;
  canViewSalesReport: boolean;
  /** مستخدم يملك الطلبات والتسجيل الداخلي: افتح التسجيل الداخلي افتراضياً عند عدم وجود قراءة/تعديل طلبات. */
  prefersStaffSalesTab: boolean;
} {
  const role = String(userRole || '').toLowerCase();
  const isAdmin = role === 'owner' || role === 'super_admin';
  const perms = Array.isArray(userPermissions) ? userPermissions : [];

  const canSubmitStaff = isAdmin || perms.includes(PERMISSIONS.STAFF_ORDERS_SUBMIT);
  const hasManagerDataAccess =
    isAdmin || hasAnyOfPermissions(userRole, ORDERS_MANAGER_DATA_ACCESS, userPermissions);
  const canViewSalesReport =
    isAdmin || hasAnyOfPermissions(userRole, ORDERS_SALES_REPORT_ACCESS, userPermissions);
  const hasOrdersReadWrite =
    isAdmin ||
    hasAnyOfPermissions(
      userRole,
      [PERMISSIONS.ORDERS_READ, PERMISSIONS.ORDERS_WRITE],
      userPermissions,
    );
  const prefersStaffSalesTab = canSubmitStaff && !hasOrdersReadWrite;

  const base = {
    canSubmitStaff,
    hasManagerDataAccess,
    canViewSalesReport,
    prefersStaffSalesTab,
  };

  if (hasManagerDataAccess || canViewSalesReport) {
    return { mode: 'manager-full', ...base };
  }
  if (canSubmitStaff) {
    return { mode: 'staff', ...base };
  }
  return { mode: 'forbidden', ...base };
}

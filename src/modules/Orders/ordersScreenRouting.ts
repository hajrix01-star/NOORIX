import {
  ORDERS_MANAGER_DATA_ACCESS,
  ORDERS_SALES_REPORT_ACCESS,
  PERMISSIONS,
  hasAnyOfPermissions,
} from '../../constants/permissions';

export type OrdersScreenMode = 'staff' | 'manager-full' | 'manager-digest-only' | 'forbidden';

export function resolveOrdersScreenMode(
  userRole: unknown,
  userPermissions: unknown,
): {
  mode: OrdersScreenMode;
  canSubmitStaff: boolean;
  canDigest: boolean;
  hasManagerDataAccess: boolean;
  canViewSalesReport: boolean;
  /** كاشير: VIEW_SALES + إرسال — يفتح تبويب تسجيل المبيعات افتراضياً */
  prefersStaffSalesTab: boolean;
} {
  const role = String(userRole || '').toLowerCase();
  const isAdmin = role === 'owner' || role === 'super_admin';
  const perms = Array.isArray(userPermissions) ? userPermissions : [];

  const canSubmitStaff = isAdmin || perms.includes(PERMISSIONS.STAFF_ORDERS_SUBMIT);
  const canDigest = isAdmin || perms.includes(PERMISSIONS.STAFF_ORDERS_DIGEST);
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
  const prefersStaffSalesTab = canSubmitStaff && hasManagerDataAccess && !hasOrdersReadWrite;

  const base = {
    canSubmitStaff,
    canDigest,
    hasManagerDataAccess,
    canViewSalesReport,
    prefersStaffSalesTab,
  };

  if (hasManagerDataAccess) {
    return { mode: 'manager-full', ...base };
  }
  if (canSubmitStaff) {
    return { mode: 'staff', ...base };
  }
  if (canDigest) {
    return { mode: 'manager-digest-only', ...base };
  }
  return { mode: 'forbidden', ...base };
}

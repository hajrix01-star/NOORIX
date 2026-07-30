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
  canSubmitDepartmentOrders: boolean;
  canSubmitInternalRegistration: boolean;
  hasManagerDataAccess: boolean;
  canViewSalesReport: boolean;
  prefersStaffSalesTab: boolean;
} {
  const role = String(userRole || '').toLowerCase();
  const isAdmin = role === 'owner' || role === 'super_admin';
  const perms = Array.isArray(userPermissions) ? userPermissions : [];

  const canSubmitDepartmentOrders = isAdmin || perms.includes(PERMISSIONS.ORDERS_STAFF_SUBMIT);
  const canSubmitInternalRegistration = isAdmin || perms.includes(PERMISSIONS.STAFF_ORDERS_SUBMIT);
  const canSubmitStaff = canSubmitDepartmentOrders || canSubmitInternalRegistration;
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
  const prefersStaffSalesTab =
    canSubmitInternalRegistration && !canSubmitDepartmentOrders && !hasOrdersReadWrite;

  const base = {
    canSubmitStaff,
    canSubmitDepartmentOrders,
    canSubmitInternalRegistration,
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

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

  if (hasManagerDataAccess) {
    return { mode: 'manager-full', canSubmitStaff, canDigest, hasManagerDataAccess, canViewSalesReport };
  }
  if (canSubmitStaff) {
    return { mode: 'staff', canSubmitStaff, canDigest, hasManagerDataAccess, canViewSalesReport };
  }
  if (canDigest) {
    return { mode: 'manager-digest-only', canSubmitStaff, canDigest, hasManagerDataAccess, canViewSalesReport };
  }
  return { mode: 'forbidden', canSubmitStaff, canDigest, hasManagerDataAccess, canViewSalesReport };
}

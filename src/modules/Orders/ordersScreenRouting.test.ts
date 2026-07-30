import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '../../constants/permissions';
import { resolveOrdersScreenMode } from './ordersScreenRouting';

describe('resolveOrdersScreenMode', () => {
  it('routes internal-registration-only staff to staff sale mode', () => {
    const perms = [PERMISSIONS.STAFF_ORDERS_SUBMIT, PERMISSIONS.VIEW_INTERNAL_REGISTRATION];
    const r = resolveOrdersScreenMode('staff', perms);

    expect(r.mode).toBe('staff');
    expect(r.canSubmitDepartmentOrders).toBe(false);
    expect(r.canSubmitInternalRegistration).toBe(true);
    expect(r.prefersStaffSalesTab).toBe(true);
  });

  it('routes department-order-only staff to staff order mode', () => {
    const perms = [PERMISSIONS.VIEW_ORDERS, PERMISSIONS.ORDERS_STAFF_SUBMIT];
    const r = resolveOrdersScreenMode('staff', perms);

    expect(r.mode).toBe('staff');
    expect(r.canSubmitDepartmentOrders).toBe(true);
    expect(r.canSubmitInternalRegistration).toBe(false);
    expect(r.prefersStaffSalesTab).toBe(false);
  });

  it('routes orders read to manager-full', () => {
    const perms = [PERMISSIONS.VIEW_ORDERS, PERMISSIONS.ORDERS_READ];
    expect(resolveOrdersScreenMode('accountant', perms).mode).toBe('manager-full');
  });

  it('routes orders write to manager-full', () => {
    const perms = [PERMISSIONS.VIEW_ORDERS, PERMISSIONS.ORDERS_WRITE];
    expect(resolveOrdersScreenMode('manager', perms).mode).toBe('manager-full');
  });

  it('routes internal report read to manager-full without orders manager access', () => {
    const perms = [PERMISSIONS.VIEW_INTERNAL_REGISTRATION, PERMISSIONS.STAFF_ORDERS_READ];
    const r = resolveOrdersScreenMode('supervisor', perms);

    expect(r.mode).toBe('manager-full');
    expect(r.hasManagerDataAccess).toBe(false);
    expect(r.canViewSalesReport).toBe(true);
  });

  it('keeps accountant with orders read and internal submit on manager screen', () => {
    const perms = [
      PERMISSIONS.VIEW_ORDERS,
      PERMISSIONS.ORDERS_READ,
      PERMISSIONS.STAFF_ORDERS_SUBMIT,
    ];
    const r = resolveOrdersScreenMode('accountant', perms);

    expect(r.mode).toBe('manager-full');
    expect(r.canSubmitInternalRegistration).toBe(true);
    expect(r.prefersStaffSalesTab).toBe(false);
  });

  it('does not grant app access from VIEW_ORDERS alone', () => {
    const perms = [PERMISSIONS.VIEW_ORDERS];
    expect(resolveOrdersScreenMode('staff', perms).mode).toBe('forbidden');
  });
});

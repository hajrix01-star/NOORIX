import { describe, it, expect } from 'vitest';
import { PERMISSIONS } from '../../constants/permissions';
import { resolveOrdersScreenMode } from './ordersScreenRouting';

describe('resolveOrdersScreenMode', () => {
  it('موظف تسجيل داخلي فقط → staff', () => {
    const perms = [PERMISSIONS.STAFF_ORDERS_SUBMIT, PERMISSIONS.VIEW_INTERNAL_REGISTRATION];
    expect(resolveOrdersScreenMode('staff', perms).mode).toBe('staff');
  });

  it('محاسب ORDERS_READ → manager-full', () => {
    const perms = [PERMISSIONS.VIEW_ORDERS, PERMISSIONS.ORDERS_READ];
    expect(resolveOrdersScreenMode('accountant', perms).mode).toBe('manager-full');
  });

  it('ORDERS_WRITE فقط → manager-full', () => {
    const perms = [PERMISSIONS.VIEW_ORDERS, PERMISSIONS.ORDERS_WRITE];
    expect(resolveOrdersScreenMode('manager', perms).mode).toBe('manager-full');
  });

  it('كاشير VIEW_SALES + تسجيل داخلي → staff وليس طلبات إدارية', () => {
    const perms = [
      PERMISSIONS.VIEW_INTERNAL_REGISTRATION,
      PERMISSIONS.VIEW_SALES,
      PERMISSIONS.STAFF_ORDERS_SUBMIT,
    ];
    const r = resolveOrdersScreenMode('cashier', perms);
    expect(r.mode).toBe('staff');
    expect(r.canSubmitStaff).toBe(true);
    expect(r.hasManagerDataAccess).toBe(false);
  });

  it('قراءة التسجيل الداخلي فقط → manager-full بدون طلبات إدارية', () => {
    const perms = [PERMISSIONS.VIEW_INTERNAL_REGISTRATION, PERMISSIONS.STAFF_ORDERS_READ];
    const r = resolveOrdersScreenMode('supervisor', perms);
    expect(r.mode).toBe('manager-full');
    expect(r.hasManagerDataAccess).toBe(false);
    expect(r.canViewSalesReport).toBe(true);
  });

  it('محاسب ORDERS_READ + تسجيل داخلي → manager-full بدون فرض التسجيل الداخلي افتراضياً', () => {
    const perms = [PERMISSIONS.VIEW_ORDERS, PERMISSIONS.ORDERS_READ, PERMISSIONS.STAFF_ORDERS_SUBMIT];
    const r = resolveOrdersScreenMode('accountant', perms);
    expect(r.mode).toBe('manager-full');
    expect(r.canSubmitStaff).toBe(true);
    expect(r.prefersStaffSalesTab).toBe(false);
  });

  it('VIEW_ORDERS فقط → forbidden', () => {
    const perms = [PERMISSIONS.VIEW_ORDERS];
    expect(resolveOrdersScreenMode('staff', perms).mode).toBe('forbidden');
  });
});

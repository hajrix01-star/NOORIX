import { describe, it, expect } from 'vitest';
import { PERMISSIONS } from '../../constants/permissions';
import { resolveOrdersScreenMode } from './ordersScreenRouting';

describe('resolveOrdersScreenMode', () => {
  it('موظف إرسال طلب تشغيلي → staff', () => {
    const perms = [PERMISSIONS.STAFF_ORDERS_SUBMIT, PERMISSIONS.VIEW_ORDERS];
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

  it('كاشير VIEW_SALES + إرسال → manager-full مع تبويب مبيعات افتراضي', () => {
    const perms = [
      PERMISSIONS.VIEW_ORDERS,
      PERMISSIONS.VIEW_SALES,
      PERMISSIONS.STAFF_ORDERS_SUBMIT,
    ];
    const r = resolveOrdersScreenMode('cashier', perms);
    expect(r.mode).toBe('manager-full');
    expect(r.canSubmitStaff).toBe(true);
    expect(r.prefersStaffSalesTab).toBe(true);
  });

  it('محاسب ORDERS_READ + إرسال → manager-full بدون تبويب مبيعات افتراضي', () => {
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

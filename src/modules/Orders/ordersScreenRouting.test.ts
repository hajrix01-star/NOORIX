import { describe, it, expect } from 'vitest';
import { PERMISSIONS } from '../../constants/permissions';
import { resolveOrdersScreenMode } from './ordersScreenRouting';

describe('resolveOrdersScreenMode', () => {
  it('موظف إرسال فقط → staff (حتى مع STAFF_ORDERS_DIGEST)', () => {
    const perms = [PERMISSIONS.STAFF_ORDERS_SUBMIT, PERMISSIONS.STAFF_ORDERS_DIGEST, PERMISSIONS.VIEW_ORDERS];
    expect(resolveOrdersScreenMode('staff', perms).mode).toBe('staff');
  });

  it('موظف إرسال بدون digest → staff', () => {
    const perms = [PERMISSIONS.STAFF_ORDERS_SUBMIT, PERMISSIONS.VIEW_ORDERS];
    expect(resolveOrdersScreenMode('staff', perms).mode).toBe('staff');
  });

  it('كاشير digest فقط → manager-digest-only', () => {
    const perms = [PERMISSIONS.STAFF_ORDERS_DIGEST, PERMISSIONS.VIEW_ORDERS];
    expect(resolveOrdersScreenMode('staff', perms).mode).toBe('manager-digest-only');
  });

  it('محاسب ORDERS_READ → manager-full', () => {
    const perms = [PERMISSIONS.VIEW_ORDERS, PERMISSIONS.ORDERS_READ];
    expect(resolveOrdersScreenMode('accountant', perms).mode).toBe('manager-full');
  });

  it('ORDERS_WRITE فقط → manager-full', () => {
    const perms = [PERMISSIONS.VIEW_ORDERS, PERMISSIONS.ORDERS_WRITE];
    expect(resolveOrdersScreenMode('manager', perms).mode).toBe('manager-full');
  });

  it('VIEW_ORDERS فقط → forbidden', () => {
    const perms = [PERMISSIONS.VIEW_ORDERS];
    expect(resolveOrdersScreenMode('staff', perms).mode).toBe('forbidden');
  });
});

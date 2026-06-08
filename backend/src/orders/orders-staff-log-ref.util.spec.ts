import {
  buildStaffSaleLogRef,
  staffSaleLogRefPrefix,
  staffSaleOperationKey,
} from './orders-staff-log-ref.util';

describe('staffSaleLogRefPrefix', () => {
  it('يُنشئ بادئة L-YYMMDD-', () => {
    const prefix = staffSaleLogRefPrefix(new Date('2026-06-08T12:00:00.000Z'));
    expect(prefix).toBe('L-260608-');
  });
});

describe('buildStaffSaleLogRef', () => {
  it('يُكمّل التسلسل بثلاث خانات', () => {
    expect(buildStaffSaleLogRef('L-260608-', 1)).toBe('L-260608-001');
    expect(buildStaffSaleLogRef('L-260608-', 42)).toBe('L-260608-042');
  });
});

describe('staffSaleOperationKey', () => {
  it('يفضّل logRef عند وجوده', () => {
    expect(staffSaleOperationKey({ id: 'abc', logRef: 'L-260608-001' })).toBe('L-260608-001');
  });

  it('يعود إلى id للسجلات القديمة', () => {
    expect(staffSaleOperationKey({ id: 'abc', logRef: null })).toBe('abc');
  });
});

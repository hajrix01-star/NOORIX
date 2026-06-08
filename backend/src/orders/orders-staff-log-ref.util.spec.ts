import {
  buildStaffSaleLogRef,
  staffSaleLogRefDateLabel,
  staffSaleLogRefLetter,
  staffSaleLogRefPrefix,
  staffSaleOperationKey,
} from './orders-staff-log-ref.util';

describe('staffSaleLogRefDateLabel', () => {
  it('يُعيد DD-MM-YYYY', () => {
    expect(staffSaleLogRefDateLabel(new Date('2026-06-08T12:00:00.000Z'))).toBe('08-06-2026');
  });
});

describe('staffSaleLogRefPrefix', () => {
  it('يُنشئ بادئة بتاريخ اليوم', () => {
    expect(staffSaleLogRefPrefix(new Date('2026-06-08T12:00:00.000Z'))).toBe('08-06-2026-');
  });
});

describe('staffSaleLogRefLetter', () => {
  it('يُحوّل التسلسل إلى A, B, C', () => {
    expect(staffSaleLogRefLetter(1)).toBe('A');
    expect(staffSaleLogRefLetter(2)).toBe('B');
    expect(staffSaleLogRefLetter(3)).toBe('C');
    expect(staffSaleLogRefLetter(26)).toBe('Z');
    expect(staffSaleLogRefLetter(27)).toBe('AA');
  });
});

describe('buildStaffSaleLogRef', () => {
  it('يجمع التاريخ والحرف', () => {
    const date = new Date('2026-06-08T12:00:00.000Z');
    expect(buildStaffSaleLogRef(date, 1)).toBe('08-06-2026-A');
    expect(buildStaffSaleLogRef(date, 3)).toBe('08-06-2026-C');
  });
});

describe('staffSaleOperationKey', () => {
  it('يفضّل logRef عند وجوده', () => {
    expect(staffSaleOperationKey({ id: 'abc', logRef: '08-06-2026-A' })).toBe('08-06-2026-A');
  });

  it('يعود إلى id للسجلات القديمة', () => {
    expect(staffSaleOperationKey({ id: 'abc', logRef: null })).toBe('abc');
  });
});

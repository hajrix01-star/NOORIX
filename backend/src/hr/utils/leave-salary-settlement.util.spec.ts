import {
  computeCalendarLeaveSalarySettlement,
  isPayableLeaveSalarySettlement,
  resolveLeaveSalarySettlementGrossAmount,
} from './leave-salary-settlement.util';

describe('leave salary settlement util', () => {
  const employee = {
    basicSalary: 3000,
    housingAllowance: 500,
    transportAllowance: 250,
    otherAllowance: 0,
    workHours: '8',
    workSchedule: '[NOORIX_WD:26]',
    joinDate: '2026-01-01',
    status: 'active',
    notes: '',
  };

  it('computes calendar leave salary settlement from the central salary package', () => {
    const calc = computeCalendarLeaveSalarySettlement(employee, new Date('2026-06-10T00:00:00.000Z'), 3900);

    expect(calc.daysInMonth).toBe(30);
    expect(calc.calendarDaysPaid).toBe(10);
    expect(calc.grossAmount).toBe(1300);
    expect(isPayableLeaveSalarySettlement(calc)).toBe(true);
  });

  it('normalizes manual gross amount overrides', () => {
    const calc = computeCalendarLeaveSalarySettlement(employee, new Date('2026-06-10T00:00:00.000Z'), 3900);

    expect(resolveLeaveSalarySettlementGrossAmount(calc, undefined)).toEqual({
      grossAmount: 1300,
      hasManualOverride: false,
    });
    expect(resolveLeaveSalarySettlementGrossAmount(calc, 1400.555)).toEqual({
      grossAmount: 1400.56,
      hasManualOverride: true,
    });
    expect(() => resolveLeaveSalarySettlementGrossAmount(calc, 0)).toThrow(RangeError);
  });
});

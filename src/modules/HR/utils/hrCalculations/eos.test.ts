import { describe, expect, it } from 'vitest';

import {
  calculateEosServiceDays,
  computeEos,
  computeEosWageFromEmployee,
  EOS_REASON_OPTIONS,
  getEosEligibilityFactor,
} from './eos';

describe('hrCalculations/eos', () => {
  it('exposes the shared EOS reason list used by HR screens', () => {
    expect(EOS_REASON_OPTIONS).toEqual([
      'employer',
      'article81',
      'resignation',
      'force_majeure',
      'maternity',
      'article80',
    ]);
  });

  it('uses actual day difference without an inclusive +1 day', () => {
    expect(calculateEosServiceDays('2026-01-09', '2026-04-09')).toBe(90);
  });

  it('uses a 365-day service year basis', () => {
    const result = computeEos({
      joinDate: '2025-01-01',
      endDate: '2026-01-01',
      wage: 12000,
      reason: 'employer',
    });

    expect(result.serviceDays).toBe(365);
    expect(result.serviceYears.toNumber()).toBe(1);
    expect(result.fullAward.toNumber()).toBe(6000);
    expect(result.eosAmount.toNumber()).toBe(6000);
  });

  it('applies Saudi resignation eligibility thresholds', () => {
    expect(getEosEligibilityFactor('resignation', 1.99).toNumber()).toBe(0);
    expect(getEosEligibilityFactor('resignation', 5).toNumber()).toBeCloseTo(1 / 3);
    expect(getEosEligibilityFactor('resignation', 9.99).toNumber()).toBeCloseTo(2 / 3);
    expect(getEosEligibilityFactor('resignation', 10).toNumber()).toBe(1);
  });

  it('handles full and zero entitlement reasons', () => {
    expect(getEosEligibilityFactor('article80', 20).toNumber()).toBe(0);
    expect(getEosEligibilityFactor('employer', 1).toNumber()).toBe(1);
    expect(getEosEligibilityFactor('article81', 1).toNumber()).toBe(1);
    expect(getEosEligibilityFactor('force_majeure', 1).toNumber()).toBe(1);
    expect(getEosEligibilityFactor('maternity', 1).toNumber()).toBe(1);
  });

  it('builds EOS wage from fixed employee wage components only', () => {
    const wage = computeEosWageFromEmployee(
      {
        basicSalary: 5000,
        housingAllowance: 1000,
        transportAllowance: 500,
        otherAllowance: 250,
        overtimeHours: 99,
      },
      300,
    );

    expect(wage.toNumber()).toBe(7050);
  });
});

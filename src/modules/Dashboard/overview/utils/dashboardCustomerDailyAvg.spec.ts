import { describe, expect, it } from 'vitest';
import {
  computeCustomerDailyAvgActiveDays,
  computeCustomerDailyAvgCalendarMtd,
  computeRevenueDailyAvgActiveDays,
  computeRevenueDailyAvgCalendarMtd,
} from './dashboardOverviewBuilders';
import { mtdCalendarDaysInMonth } from './dashboardOverviewDateUtils';

describe('computeRevenueDailyAvgActiveDays', () => {
  it('averages revenue across active days only', () => {
    const avg = computeRevenueDailyAvgActiveDays([
      { transactionDate: '2026-05-01', totalAmount: 1000 },
      { transactionDate: '2026-05-01', totalAmount: 500 },
      { transactionDate: '2026-05-02', totalAmount: 900 },
      { transactionDate: '2026-05-03', totalAmount: 0 },
    ]);
    expect(avg).toBe(1200);
  });
});

describe('computeRevenueDailyAvgCalendarMtd', () => {
  it('divides month total by calendar days through end day', () => {
    const sales = [
      { transactionDate: '2026-05-10', totalAmount: 1000 },
      { transactionDate: '2026-05-20', totalAmount: 500 },
    ];
    expect(computeRevenueDailyAvgCalendarMtd(sales, 2026, 5, 20)).toBe(75);
    expect(mtdCalendarDaysInMonth(2026, 5, 2026, 5, 26)).toBe(26);
    expect(computeRevenueDailyAvgCalendarMtd(sales, 2026, 5, 26)).toBeCloseTo(1500 / 26, 5);
  });
});

describe('computeCustomerDailyAvgCalendarMtd', () => {
  it('averages customers per calendar day', () => {
    const avg = computeCustomerDailyAvgCalendarMtd(
      [
        { transactionDate: '2026-05-01', customerCount: 100 },
        { transactionDate: '2026-05-02', customerCount: 50 },
      ],
      2026,
      5,
      2,
    );
    expect(avg).toBe(75);
  });
});

describe('computeCustomerDailyAvgActiveDays', () => {
  it('sums customers per day then averages active days', () => {
    const avg = computeCustomerDailyAvgActiveDays([
      { transactionDate: '2026-05-01', customerCount: 30 },
      { transactionDate: '2026-05-01', customerCount: 20 },
      { transactionDate: '2026-05-02', customerCount: 50 },
      { transactionDate: '2026-05-03', customerCount: 0 },
    ]);
    expect(avg).toBe(50);
  });

  it('returns null when no active customer days', () => {
    expect(
      computeCustomerDailyAvgActiveDays([
        { transactionDate: '2026-05-01', customerCount: 0 },
      ]),
    ).toBeNull();
    expect(computeCustomerDailyAvgActiveDays([])).toBeNull();
  });
});

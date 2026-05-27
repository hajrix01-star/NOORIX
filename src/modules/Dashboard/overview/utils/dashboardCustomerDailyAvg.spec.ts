import { describe, expect, it } from 'vitest';
import {
  computeCustomerDailyAvgActiveDays,
  computeCustomerDailyAvgCalendarMtd,
  computeRevenueDailyAvgActiveDays,
  computeRevenueDailyAvgCalendarMtd,
  countRevenueActiveSalesDays,
  sumRevenueThroughDay,
} from './dashboardOverviewBuilders';
import { mtdCalendarDaysInMonth } from './dashboardOverviewDateUtils';

describe('revenue MTD totals and active day count', () => {
  it('calendar avg vs active-day avg when one calendar day has zero sales', () => {
    const sales = [
      { transactionDate: '2026-05-01', totalAmount: 1000 },
      { transactionDate: '2026-05-02', totalAmount: 2000 },
      { transactionDate: '2026-05-03', totalAmount: 0 },
    ];
    const total = sumRevenueThroughDay(sales, 2026, 5, 3);
    expect(total).toBe(3000);
    expect(countRevenueActiveSalesDays(sales, 2026, 5, 3)).toBe(2);
    expect(computeRevenueDailyAvgCalendarMtd(sales, 2026, 5, 3)).toBe(1000);
    const through = sales.filter((s) => s.transactionDate !== '2026-05-03');
    expect(computeRevenueDailyAvgActiveDays(through)).toBe(1500);
  });
});

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

  it('excludes sales after end day from MTD total', () => {
    const sales = [
      { transactionDate: '2026-05-10', totalAmount: 1000 },
      { transactionDate: '2026-05-28', totalAmount: 9000 },
    ];
    expect(computeRevenueDailyAvgCalendarMtd(sales, 2026, 5, 20)).toBe(50);
  });

  it('compares same calendar span for previous month', () => {
    const april = [
      { transactionDate: '2026-04-05', totalAmount: 400 },
      { transactionDate: '2026-04-15', totalAmount: 600 },
      { transactionDate: '2026-04-28', totalAmount: 3000 },
    ];
    expect(computeRevenueDailyAvgCalendarMtd(april, 2026, 4, 20)).toBe(50);
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

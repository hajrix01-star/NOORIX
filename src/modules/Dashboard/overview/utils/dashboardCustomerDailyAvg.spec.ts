import { describe, expect, it } from 'vitest';
import {
  computeCustomerDailyAvgActiveDays,
  computeRevenueDailyAvgActiveDays,
  countRevenueActiveSalesDays,
  lastRevenueSalesDayInMonth,
  revenueMtdEndDay,
  sumRevenueThroughDay,
} from './dashboardOverviewBuilders';
import { mtdCalendarDaysInMonth } from './dashboardOverviewDateUtils';

describe('revenue MTD totals and active day count', () => {
  it('sums through end day and counts only days with revenue > 0', () => {
    const sales = [
      { transactionDate: '2026-05-01', totalAmount: 1000 },
      { transactionDate: '2026-05-02', totalAmount: 2000 },
      { transactionDate: '2026-05-03', totalAmount: 0 },
    ];
    const total = sumRevenueThroughDay(sales, 2026, 5, 3);
    expect(total).toBe(3000);
    expect(countRevenueActiveSalesDays(sales, 2026, 5, 3)).toBe(2);
    const through = sales.filter((s) => s.transactionDate !== '2026-05-03');
    expect(computeRevenueDailyAvgActiveDays(through)).toBe(1500);
  });

  it('revenueMtdEndDay uses last sales entry day capped by calendar today', () => {
    const sales = [
      { transactionDate: '2026-05-10', totalAmount: 1000 },
      { transactionDate: '2026-05-25', totalAmount: 500 },
    ];
    expect(lastRevenueSalesDayInMonth(sales, 2026, 5)).toBe(25);
    expect(revenueMtdEndDay(2026, 5, 2026, 5, 27, sales)).toBe(25);
    expect(revenueMtdEndDay(2026, 5, 2026, 5, 20, sales)).toBe(20);
  });

  it('prev month total through aligned end day', () => {
    const april = [
      { transactionDate: '2026-04-10', totalAmount: 1000 },
      { transactionDate: '2026-04-28', totalAmount: 9000 },
    ];
    expect(sumRevenueThroughDay(april, 2026, 4, 27)).toBe(1000);
  });

  it('mtd end day caps period without using calendar-day divisor', () => {
    expect(mtdCalendarDaysInMonth(2026, 5, 2026, 5, 26)).toBe(26);
    const sales = [
      { transactionDate: '2026-05-10', totalAmount: 1000 },
      { transactionDate: '2026-05-28', totalAmount: 9000 },
    ];
    const through = sales.filter((s) => s.transactionDate === '2026-05-10');
    expect(computeRevenueDailyAvgActiveDays(through)).toBe(1000);
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

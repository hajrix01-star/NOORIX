import { describe, expect, it } from 'vitest';
import {
  computeCustomerMonthDailyAvg,
  computeCustomerDailyAvgActiveDays,
  computeDailyAvgForCalendarPeriod,
  computeRevenueMonthDailyAvg,
  computeRevenueDailyAvgActiveDays,
  countRevenueActiveSalesDays,
  lastRevenueSalesDayInMonth,
  revenueMtdEndDay,
  sumRevenueThroughDay,
} from './dashboardDailyAvg';
import { buildYearMonthlyDailyAvgRows } from './dashboardOverviewBuilders';
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

  it('MTD comparison uses calendar days so avg matches total ÷ period length', () => {
    const juneTotal = 92848;
    const mayTotal = 97859;
    const periodDays = 18;
    const juneAvg = computeDailyAvgForCalendarPeriod(juneTotal, periodDays);
    const mayAvg = computeDailyAvgForCalendarPeriod(mayTotal, periodDays);
    expect(juneAvg).toBeCloseTo(5158.22, 1);
    expect(mayAvg).toBeCloseTo(5436.61, 1);
    expect(computeRevenueDailyAvgActiveDays(
      Array.from({ length: 15 }, (_, i) => ({
        transactionDate: `2026-06-${String(i + 1).padStart(2, '0')}`,
        totalAmount: juneTotal / 15,
      })),
    )).toBeCloseTo(6189.87, 0);
  });
  it('computes revenue and customer averages through the selected MTD end day', () => {
    const july = [
      { transactionDate: '2026-07-01', totalAmount: 1000, customerCount: 10 },
      { transactionDate: '2026-07-10', totalAmount: 9000, customerCount: 90 },
      { transactionDate: '2026-07-20', totalAmount: 5000, customerCount: 50 },
    ];
    const revenueAvg = computeRevenueMonthDailyAvg({
      monthSales: july,
      year: 2026,
      month: 7,
      todayYear: 2026,
      todayMonth: 7,
      todayDay: 10,
      endDayInclusive: 10,
    });
    const customerAvg = computeCustomerMonthDailyAvg({
      monthSales: july,
      year: 2026,
      month: 7,
      todayYear: 2026,
      todayMonth: 7,
      todayDay: 10,
      endDayInclusive: 10,
    });
    expect(revenueAvg.total).toBe(10000);
    expect(revenueAvg.avgDaily).toBe(1000);
    expect(customerAvg.total).toBe(100);
    expect(customerAvg.avgDaily).toBe(10);
  });

  it('aligns previous month daily-average row to the current MTD day when requested', () => {
    const rows = buildYearMonthlyDailyAvgRows({
      year: 2026,
      yearSummaries: [
        { transactionDate: '2026-06-01', totalAmount: 3000 },
        { transactionDate: '2026-06-20', totalAmount: 6000 },
        { transactionDate: '2026-07-01', totalAmount: 1000 },
        { transactionDate: '2026-07-10', totalAmount: 9000 },
      ],
      monthNames: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
      capMonth: 7,
      currentYear: 2026,
      currentMonth: 7,
      currentDay: 10,
      prevMonthAlignEndDay: 10,
    });
    expect(rows[5].totalSales).toBe(3000);
    expect(rows[5].avgDaily).toBe(300);
    expect(rows[6].totalSales).toBe(10000);
    expect(rows[6].avgDaily).toBe(1000);
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

import { describe, expect, it } from 'vitest';
import {
  computeRevenueMonthDailyAvg,
  dailyAvgFromTotal,
  resolvePeriodEndDay,
  revenueMtdEndDay,
} from './dashboardDailyAvg';

describe('dashboardDailyAvg — single source', () => {
  const juneSales = [
    { transactionDate: '2026-06-01', totalAmount: 5000 },
    { transactionDate: '2026-06-02', totalAmount: 5000 },
    { transactionDate: '2026-06-15', totalAmount: 82848 },
  ];

  it('computeRevenueMonthDailyAvg: total ÷ calendar days (MTD)', () => {
    const result = computeRevenueMonthDailyAvg({
      monthSales: juneSales,
      year: 2026,
      month: 6,
      todayYear: 2026,
      todayMonth: 6,
      todayDay: 18,
    });

    expect(result.endDayInclusive).toBe(15);
    expect(result.total).toBe(92848);
    expect(result.calendarDays).toBe(15);
    expect(result.avgDaily).toBeCloseTo(92848 / 15, 2);
  });

  it('revenueMtdEndDay matches resolvePeriodEndDay', () => {
    expect(revenueMtdEndDay(2026, 6, 2026, 6, 18, juneSales)).toBe(15);
    expect(
      resolvePeriodEndDay({
        year: 2026,
        month: 6,
        todayYear: 2026,
        todayMonth: 6,
        todayDay: 18,
        monthSales: juneSales,
      }),
    ).toBe(15);
  });

  it('dailyAvgFromTotal matches overview card example', () => {
    expect(dailyAvgFromTotal(92848, 18)).toBeCloseTo(5158.22, 1);
    expect(dailyAvgFromTotal(97859, 18)).toBeCloseTo(5436.61, 1);
  });

  it('calendar tab path equals overview MTD when given same summaries', () => {
    const overview = computeRevenueMonthDailyAvg({
      monthSales: juneSales,
      year: 2026,
      month: 6,
      todayYear: 2026,
      todayMonth: 6,
      todayDay: 18,
    });
    const calendar = computeRevenueMonthDailyAvg({
      monthSales: juneSales,
      year: 2026,
      month: 6,
      todayYear: 2026,
      todayMonth: 6,
      todayDay: 18,
    });
    expect(calendar.avgDaily).toBe(overview.avgDaily);
    expect(calendar.total).toBe(overview.total);
    expect(calendar.endDayInclusive).toBe(overview.endDayInclusive);
  });

  it('aligned prev month uses explicit endDayInclusive', () => {
    const maySales = [
      { transactionDate: '2026-05-10', totalAmount: 1000 },
      { transactionDate: '2026-05-28', totalAmount: 9000 },
    ];
    const result = computeRevenueMonthDailyAvg({
      monthSales: maySales,
      year: 2026,
      month: 5,
      todayYear: 2026,
      todayMonth: 6,
      todayDay: 18,
      endDayInclusive: 18,
    });
    expect(result.total).toBe(1000);
    expect(result.avgDaily).toBeCloseTo(1000 / 18, 4);
  });
});

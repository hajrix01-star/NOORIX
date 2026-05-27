import { describe, expect, it } from 'vitest';
import { bucketMonthIntoWeeks, pctChangeVsBaseline } from './dashboardWeeklySales';

describe('dashboardWeeklySales', () => {
  it('bucketMonthIntoWeeks splits month into 7-day chunks and averages per chunk', () => {
    const year = 2026;
    const month = 4;
    const daily = [
      { transactionDate: `${year}-${String(month).padStart(2, '0')}-01`, totalAmount: 1000 },
      { transactionDate: `${year}-${String(month).padStart(2, '0')}-02`, totalAmount: 1000 },
      { transactionDate: `${year}-${String(month).padStart(2, '0')}-08`, totalAmount: 7000 },
    ];
    const buckets = bucketMonthIntoWeeks(year, month, daily);
    expect(buckets.length).toBeGreaterThanOrEqual(4);
    expect(buckets[0].dayStart).toBe(1);
    expect(buckets[0].dayEnd).toBe(7);
    expect(buckets[0].totalSales).toBe(2000);
    expect(buckets[0].avgDailyInWeek).toBeCloseTo(2000 / 7, 5);
    const w2 = buckets[1];
    expect(w2.dayStart).toBe(8);
    expect(w2.dayEnd).toBe(14);
    expect(w2.totalSales).toBe(7000);
    expect(w2.avgDailyInWeek).toBeCloseTo(7000 / 7, 5);
  });

  it('pctChangeVsBaseline handles zero baseline', () => {
    expect(pctChangeVsBaseline(100, 0)).toBeNull();
  });

  it('pctChangeVsBaseline', () => {
    expect(pctChangeVsBaseline(110, 100)).toBeCloseTo(10, 5);
  });

  it('uses elapsed days in partial final week when maxDayInclusive is set', () => {
    const year = 2026;
    const month = 5;
    const daily = [
      { transactionDate: '2026-05-22', totalAmount: 500 },
      { transactionDate: '2026-05-24', totalAmount: 500 },
    ];
    const buckets = bucketMonthIntoWeeks(year, month, daily, { maxDayInclusive: 26 });
    const last = buckets[buckets.length - 1];
    expect(last.dayStart).toBe(22);
    expect(last.dayEnd).toBe(28);
    expect(last.totalSales).toBe(1000);
    expect(last.avgDailyInWeek).toBe(200);
  });
});

import { describe, expect, it } from 'vitest';
import { bucketMonthIntoWeeks, pctChangeVsBaseline } from './dashboardWeeklySales';

describe('dashboardWeeklySales', () => {
  it('bucketMonthIntoWeeks splits month into 7-day chunks and averages per calendar day in slice', () => {
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
    expect(buckets[0].calendarDaysInSlice).toBe(7);
    expect(buckets[0].avgDailyInWeek).toBeCloseTo(2000 / 7, 4);
    const w2 = buckets[1];
    expect(w2.dayStart).toBe(8);
    expect(w2.dayEnd).toBe(14);
    expect(w2.totalSales).toBe(7000);
    expect(w2.calendarDaysInSlice).toBe(7);
    expect(w2.avgDailyInWeek).toBeCloseTo(7000 / 7, 4);
  });

  it('pctChangeVsBaseline handles zero baseline', () => {
    expect(pctChangeVsBaseline(100, 0)).toBeNull();
  });

  it('pctChangeVsBaseline', () => {
    expect(pctChangeVsBaseline(110, 100)).toBeCloseTo(10, 5);
  });

  it('uses calendar days in partial final week when maxDayInclusive is set', () => {
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
    expect(last.calendarDaysInSlice).toBe(5);
    expect(last.avgDailyInWeek).toBe(200);
  });

  it('returns zero average when a week slice has no sales', () => {
    const buckets = bucketMonthIntoWeeks(2026, 6, [
      { transactionDate: '2026-06-15', totalAmount: 3000 },
    ]);
    expect(buckets[1].totalSales).toBe(0);
    expect(buckets[1].avgDailyInWeek).toBe(0);
    expect(buckets[2].totalSales).toBe(3000);
    expect(buckets[2].calendarDaysInSlice).toBe(7);
    expect(buckets[2].avgDailyInWeek).toBeCloseTo(3000 / 7, 4);
  });

  it('weekly averages reconcile with period total (calendar days)', () => {
    const year = 2026;
    const month = 6;
    const cap = 18;
    const daily = [
      { transactionDate: '2026-06-01', totalAmount: 1000 },
      { transactionDate: '2026-06-03', totalAmount: 2000 },
      { transactionDate: '2026-06-08', totalAmount: 4000 },
      { transactionDate: '2026-06-15', totalAmount: 8000 },
    ];
    const buckets = bucketMonthIntoWeeks(year, month, daily, { maxDayInclusive: cap });
    const reconstructed = buckets.reduce(
      (sum, b) => sum + b.avgDailyInWeek * b.calendarDaysInSlice,
      0,
    );
    const directTotal = daily.reduce((s, d) => s + Number(d.totalAmount || 0), 0);
    expect(reconstructed).toBeCloseTo(directTotal, 4);
  });
});

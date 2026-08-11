import { describe, expect, it } from 'vitest';
import { buildDashboardCalendarLedgerMetrics } from './dashboardCalendarLedgerMetrics';

describe('dashboard calendar ledger metrics', () => {
  it('uses only ledger timeline amounts for daily and weekday totals', () => {
    const result = buildDashboardCalendarLedgerMetrics({
      rows: [
        { label: '1', sales: '100' },
        { label: '2', sales: 50 },
        { label: 'bad', sales: 999 },
      ],
      year: 2026,
      month: 7,
      lastDay: 31,
      calendarDayCap: 31,
    });

    expect(result.dailySales.get('2026-07-01')).toBe(100);
    expect(result.dailySales.get('2026-07-02')).toBe(50);
    expect(result.salesDailyAvgCalendarPeriod).toBeCloseTo(150 / 31);
    expect(result.weekdaySalesAverages.reduce((sum, row) => sum + row.totalSales, 0)).toBe(150);
  });

  it('does not accept operational summary amounts as an input', () => {
    const result = buildDashboardCalendarLedgerMetrics({
      rows: [],
      year: 2026,
      month: 7,
      lastDay: 31,
      calendarDayCap: 31,
    });
    expect([...result.dailySales.values()]).toEqual([]);
    expect(result.salesDailyAvgCalendarPeriod).toBe(0);
  });

  it('keeps future ledger days visible while excluding them from averages and weekday totals', () => {
    const result = buildDashboardCalendarLedgerMetrics({
      rows: [{ label: '11', sales: 100 }, { label: '20', sales: 999 }],
      year: 2026,
      month: 8,
      lastDay: 31,
      calendarDayCap: 11,
    });

    expect(result.dailySales.get('2026-08-20')).toBe(999);
    expect(result.salesDailyAvgCalendarPeriod).toBeCloseTo(100 / 11);
    expect(result.weekdaySalesAverages.reduce((sum, row) => sum + row.totalSales, 0)).toBe(100);
  });
});

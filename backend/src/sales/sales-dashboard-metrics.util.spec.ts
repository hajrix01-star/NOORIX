import { periodDailyAverage, weekdayAverageRows } from './sales-dashboard-metrics.util';

describe('sales dashboard metrics', () => {
  it('computes basket average from backend period totals and customers', () => {
    const avg = periodDailyAverage([
      { transactionDate: '2026-07-01', shift: 'morning', totalAmount: '100', customerCount: 2 },
      { transactionDate: '2026-07-02', shift: 'evening', totalAmount: '200', customerCount: 4 },
    ], 2);

    expect(avg.total).toBe(300);
    expect(avg.customerCount).toBe(6);
    expect(avg.revenueAvgDaily).toBe(150);
    expect(avg.customerAvgDaily).toBe(3);
    expect(avg.basketAvg).toBe(50);
  });

  it('keeps basket average empty when there are no customers', () => {
    const avg = periodDailyAverage([
      { transactionDate: '2026-07-01', shift: 'morning', totalAmount: '100', customerCount: 0 },
    ], 1);

    expect(avg.basketAvg).toBeNull();
  });

  it('computes weekday averages through the official calendar-day cap', () => {
    const rows = weekdayAverageRows([
      { transactionDate: '2026-07-01', shift: 'morning', totalAmount: '100', customerCount: 2 },
      { transactionDate: '2026-07-01', shift: 'evening', totalAmount: '50', customerCount: 1 },
      { transactionDate: '2026-07-02', shift: 'all', totalAmount: '80', customerCount: 2 },
      { transactionDate: '2026-07-08', shift: 'all', totalAmount: '250', customerCount: 4 },
    ], 10);

    expect(rows).toHaveLength(7);
    expect(rows.reduce((sum, row) => sum + row.calendarDays, 0)).toBe(10);
    expect(rows.find((row) => row.dow === 3)).toEqual({
      dow: 3,
      totalSales: 400,
      calendarDays: 2,
      avgDaily: 200,
    });
    expect(rows.find((row) => row.dow === 4)).toEqual({
      dow: 4,
      totalSales: 80,
      calendarDays: 2,
      avgDaily: 40,
    });
    expect(rows.find((row) => row.dow === 5)?.avgDaily).toBe(0);
  });
});

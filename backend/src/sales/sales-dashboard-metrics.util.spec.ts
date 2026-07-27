import { periodDailyAverage } from './sales-dashboard-metrics.util';

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
});

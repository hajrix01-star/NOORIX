import { describe, expect, it } from 'vitest';
import { avgWeeklySalesFromMonthTotal, pctChangeVsBaseline } from './dashboardWeeklySales';

describe('dashboardWeeklySales', () => {
  it('avgWeeklySalesFromMonthTotal scales by days in month', () => {
    // 90000 in 30-day month => 90000 * 7 / 30 = 21000
    expect(avgWeeklySalesFromMonthTotal(90000, 2026, 4)).toBeCloseTo(21000, 5);
  });

  it('pctChangeVsBaseline handles zero baseline', () => {
    expect(pctChangeVsBaseline(100, 0)).toBeNull();
  });

  it('pctChangeVsBaseline', () => {
    expect(pctChangeVsBaseline(110, 100)).toBeCloseTo(10, 5);
  });
});

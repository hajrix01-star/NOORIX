import { describe, it, expect } from 'vitest';
import { computeSalesShiftPeriodTotals } from './dashboardSalesShiftTotals';

describe('computeSalesShiftPeriodTotals', () => {
  it('aggregates by shift', () => {
    const t = computeSalesShiftPeriodTotals([
      { shift: 'morning', totalAmount: 100, customerCount: 5 },
      { shift: 'evening', totalAmount: 200, customerCount: 8 },
      { shift: 'all', totalAmount: 50, customerCount: 2 },
    ]);
    expect(t.morning.amount).toBe(100);
    expect(t.evening.amount).toBe(200);
    expect(t.all.amount).toBe(50);
    expect(t.morning.customers).toBe(5);
  });
});

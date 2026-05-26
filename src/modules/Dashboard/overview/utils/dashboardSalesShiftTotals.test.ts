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

  it('uses shift from legacy notes when DB shift is all', () => {
    const t = computeSalesShiftPeriodTotals([
      {
        shift: 'all',
        notes: '[شفت: شفت صباحي]',
        totalAmount: 80,
        customerCount: 4,
      },
      {
        shift: 'all',
        notes: '[شفت: شفت مسائي]',
        totalAmount: 120,
        customerCount: 6,
      },
    ]);
    expect(t.morning.amount).toBe(80);
    expect(t.evening.amount).toBe(120);
    expect(t.all.amount).toBe(0);
  });
});

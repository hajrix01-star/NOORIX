import { describe, it, expect } from 'vitest';
import { aggregateSalesDayByShift, buildDailyShiftWhatsAppText } from './salesDayShiftReport';

describe('aggregateSalesDayByShift', () => {
  it('sums by shift and grand total for one day', () => {
    const r = aggregateSalesDayByShift(
      [
        { status: 'active', transactionDate: '2026-05-10', shift: 'morning', totalAmount: 100, customerCount: 10 },
        { status: 'active', transactionDate: '2026-05-10', shift: 'evening', totalAmount: 200, customerCount: 20 },
        { status: 'cancelled', transactionDate: '2026-05-10', shift: 'morning', totalAmount: 999, customerCount: 99 },
        { status: 'active', transactionDate: '2026-05-11', shift: 'morning', totalAmount: 50, customerCount: 5 },
      ],
      '2026-05-10',
    );
    expect(r.morning.total).toBe(100);
    expect(r.evening.total).toBe(200);
    expect(r.grand.total).toBe(300);
    expect(r.grand.customers).toBe(30);
  });
});

describe('buildDailyShiftWhatsAppText', () => {
  const t = (k: string) => k;

  it('includes grand total line', () => {
    const text = buildDailyShiftWhatsAppText({
      companyName: 'مطعم',
      dateLabel: '2026-05-10',
      report: {
        morning: { total: 100, customers: 10, summaryCount: 1 },
        evening: { total: 0, customers: 0, summaryCount: 0 },
        fullDay: { total: 0, customers: 0, summaryCount: 0 },
        grand: { total: 100, customers: 10, summaryCount: 1 },
      },
      t,
    });
    expect(text).toContain('salesDailyWaGrandTotal');
    expect(text).toContain('100');
  });
});

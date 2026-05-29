import { describe, it, expect } from 'vitest';
import {
  aggregateSalesDayByShift,
  buildDailyShiftWhatsAppText,
  buildDayShiftReportFromEntryItems,
} from './salesDayShiftReport';

describe('aggregateSalesDayByShift', () => {
  it('reads shift from legacy notes tag when DB shift is all', () => {
    const r = aggregateSalesDayByShift(
      [
        {
          status: 'active',
          transactionDate: '2026-05-26',
          shift: 'all',
          totalAmount: 10,
          customerCount: 10,
          notes: 'ملاحظة\n[شفت: شفت صباحي]',
        },
      ],
      '2026-05-26',
    );
    expect(r.morning.total).toBe(10);
    expect(r.fullDay.summaryCount).toBe(0);
  });

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

describe('buildDayShiftReportFromEntryItems', () => {
  it('places morning/evening from entry items even when API shift is all', () => {
    const report = buildDayShiftReportFromEntryItems(
      [{ totalAmount: 100, customerCount: 5, shift: 'all' }],
      [{ shift: 'morning' }],
    );
    expect(report.morning.total).toBe(100);
    expect(report.fullDay.summaryCount).toBe(0);
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
    expect(text).toContain('━━━━━━━━');
  });

  it('includes sales channels when day summaries provided', () => {
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
      dayYmd: '2026-05-10',
      lang: 'ar',
      daySummaries: [
        {
          status: 'active',
          transactionDate: '2026-05-10',
          shift: 'morning',
          channels: [{ vault: { nameAr: 'نقدي', sortOrder: 1 }, amount: 100 }],
        },
      ],
    });
    expect(text).toContain('salesWhatsAppChannelsHeader');
    expect(text).toContain('│ نقدي');
    expect(text).toContain('100');
  });
});

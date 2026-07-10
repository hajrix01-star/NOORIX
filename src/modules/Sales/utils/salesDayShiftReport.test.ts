import { describe, expect, it } from 'vitest';
import {
  aggregateSalesDayByShift,
  buildDailyShiftWhatsAppText,
  buildDayShiftReportFromEntryItems,
} from './salesDayShiftReport';
import { formatShiftNoteTag } from '../constants/salesShift';

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
          notes: `note\n${formatShiftNoteTag('morning')}`,
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

  it('builds a compact daily sales summary', () => {
    const text = buildDailyShiftWhatsAppText({
      companyName: 'Noorix',
      dateLabel: 'Friday 2026-07-10',
      report: {
        morning: { total: 4000, customers: 40, summaryCount: 1 },
        evening: { total: 6000, customers: 60, summaryCount: 1 },
        fullDay: { total: 0, customers: 0, summaryCount: 0 },
        grand: { total: 10000, customers: 100, summaryCount: 2 },
      },
      t,
    });

    expect(text).toContain('ملخص مبيعات اليوم');
    expect(text).toContain('Noorix');
    expect(text).toContain('الصباحي 4,000 | 40 عميل | متوسط 100');
    expect(text).toContain('المسائي 6,000 | 60 عميل | متوسط 100');
    expect(text).toContain('الإجمالي 10,000');
    expect(text).toContain('العملاء 100');
    expect(text).toContain('متوسط العميل 100');
    expect(text).not.toContain('salesDailyWaGrandTotal');
  });

  it('includes sales channels as one compact collection line', () => {
    const text = buildDailyShiftWhatsAppText({
      companyName: 'Noorix',
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
          channels: [{ vault: { nameAr: 'Cash', sortOrder: 1 }, amount: 100 }],
        },
      ],
    });

    expect(text).toContain('التحصيل: Cash: 100');
    expect(text).not.toContain('salesWhatsAppChannelsHeader');
    expect(text).not.toContain('•');
  });

  it('includes compact app share for day and month without amounts', () => {
    const text = buildDailyShiftWhatsAppText({
      companyName: 'Noorix',
      dateLabel: '2026-05-10',
      report: {
        morning: { total: 1000, customers: 10, summaryCount: 1 },
        evening: { total: 0, customers: 0, summaryCount: 0 },
        fullDay: { total: 0, customers: 0, summaryCount: 0 },
        grand: { total: 1000, customers: 10, summaryCount: 1 },
      },
      t,
      dayYmd: '2026-05-10',
      lang: 'ar',
      daySummaries: [
        {
          status: 'active',
          transactionDate: '2026-05-10',
          shift: 'morning',
          totalAmount: 1000,
          channels: [
            { amount: 300, vault: { type: 'app', nameAr: 'App', sortOrder: 1 } },
            { amount: 700, vault: { type: 'cash', nameAr: 'Cash', sortOrder: 2 } },
          ],
        },
      ],
      monthAppShare: { appAmount: 500, totalAmount: 2000, appPercent: 25 },
    });

    expect(text).toContain('التطبيقات: اليوم 30% | الشهر 25%');
    expect(text).not.toContain('2,000');
    expect(text).not.toContain('500');
  });
});

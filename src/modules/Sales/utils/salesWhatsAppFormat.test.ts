import { describe, it, expect } from 'vitest';
import {
  SALES_WA,
  waChannelRow,
  waReportHeader,
  waShiftSectionTitle,
} from './salesWhatsAppFormat';
import { buildDailyShiftWhatsAppText } from './salesDayShiftReport';

describe('salesWhatsAppFormat', () => {
  it('uses BMP symbols for shift sections', () => {
    const section = waShiftSectionTitle('morning', 'شفت صباحي');
    expect(section).toContain(SALES_WA.morning);
    expect(section).toContain('شفت صباحي');
    expect(section).toContain(SALES_WA.ruleThin);
  });

  it('formats channel rows with branch character', () => {
    expect(waChannelRow('بنك', '996')).toBe('  • بنك: 996 SR');
  });

  it('puts report title on the first line without a rule separator', () => {
    const h = waReportHeader('تقرير مبيعات يومي', 'ARZ');
    expect(h).toContain('تقرير مبيعات يومي — ARZ');
    expect(h.startsWith(SALES_WA.rule)).toBe(false);
  });
});

describe('buildDailyShiftWhatsAppText formatting', () => {
  const t = (k: string) => k;

  it('includes shift symbols and separators', () => {
    const text = buildDailyShiftWhatsAppText({
      companyName: 'ARZ',
      dateLabel: '28-05-2026 الخميس',
      report: {
        morning: { total: 1081, customers: 17, summaryCount: 1 },
        evening: { total: 5382, customers: 68, summaryCount: 1 },
        fullDay: { total: 0, customers: 0, summaryCount: 0 },
        grand: { total: 6463, customers: 85, summaryCount: 2 },
      },
      t,
      dayYmd: '2026-05-28',
      lang: 'ar',
      daySummaries: [
        {
          status: 'active',
          transactionDate: '2026-05-28',
          shift: 'morning',
          channels: [{ vault: { nameAr: 'نقد', sortOrder: 1 }, amount: 85 }],
        },
      ],
    });
    expect(text).toContain(SALES_WA.morning);
    expect(text).toContain(SALES_WA.evening);
    expect(text).toContain(SALES_WA.grand);
    expect(text).toContain('• نقد');
    expect(text).toContain('🌅');
    expect(text).toContain('salesWhatsAppChannelsHeader');
    expect(text).toContain('salesWhatsAppAvgInvoiceLine');
  });
});

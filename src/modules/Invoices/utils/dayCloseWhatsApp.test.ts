import { describe, it, expect } from 'vitest';
import { buildDayCloseWhatsAppText } from './dayCloseWhatsApp';

describe('buildDayCloseWhatsAppText', () => {
  const t = (k: string) => k;

  const kindLabel = { sale: 'مبيعات', purchase: 'مشتريات', expense: 'مصروف' };

  it('builds brief digest with day cash available = in − out', () => {
    const text = buildDayCloseWhatsAppText({
      companyName: 'ARZ',
      dateLabel: '28-05-2026 الخميس',
      data: {
        sums: { inflow: { total: 6463, count: 10 }, outflow: { total: 2990, count: 5 } },
        cash: { dayTotalIn: 500, dayTotalOut: 100, netDay: 400 },
        byKind: [
          { kind: 'sale', count: 10, total: 6463 },
          { kind: 'purchase', count: 2, total: 2100 },
          { kind: 'expense', count: 3, total: 890 },
        ],
        salesSummaries: [
          {
            totalAmount: 6463,
            customerCount: 85,
            channels: [
              { vaultNameAr: 'بنك', vaultType: 'bank', amount: 5607 },
              { vaultNameAr: 'نقد', vaultType: 'cash', amount: 856 },
            ],
          },
        ],
      },
      kindLabel,
      lang: 'ar',
      t,
    });

    expect(text).toContain('ARZ');
    expect(text).toContain('dayCloseWaSectionSales');
    expect(text).toContain('• بنك:');
    expect(text).toContain('dayCloseWaCustomersLine');
    expect(text).toContain('dayCloseWaSalesTotal');
    expect(text).toContain('🌅');
    expect(text).toContain('📌');
    expect(text.indexOf('dayCloseWaCustomersLine')).toBeGreaterThan(text.indexOf('• بنك:'));
    expect(text).toContain('dayCloseWaPurchases');
    expect(text).toContain('dayCloseWaExpenses');
    expect(text).toContain('dayCloseWaCashIn');
    expect(text).toContain('500');
    expect(text).toContain('dayCloseWaCashOut');
    expect(text).toContain('100');
    expect(text).toContain('dayCloseWaCashAvailable');
    expect(text).toContain('400');
    expect(text).not.toContain('INV-');
    expect(text).not.toContain('dayCloseWaOpsMore');
  });

  it('uses netDay from cash when in/out differ from computed', () => {
    const text = buildDayCloseWhatsAppText({
      companyName: '',
      dateLabel: '2026-05-29',
      data: {
        sums: { inflow: { total: 0 }, outflow: { total: 0 } },
        cash: { dayTotalIn: 500, dayTotalOut: 100, netDay: 400 },
        byKind: [],
        salesSummaries: [],
      },
      kindLabel,
      lang: 'en',
      t,
    });
    expect(text).toContain('400');
  });
});

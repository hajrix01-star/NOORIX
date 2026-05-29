import { describe, it, expect } from 'vitest';
import { buildDayCloseWhatsAppText } from './dayCloseWhatsApp';

describe('buildDayCloseWhatsAppText', () => {
  const t = (k: string, ...args: unknown[]) => {
    if (k === 'dayCloseLifetimeCashFootnote' && args.length) return `lifetime ${args[0]}`;
    if (k === 'dayCloseWaOpsMore' && args.length >= 2) return `more ${args[0]} total ${args[1]} shown`;
    return k;
  };

  const kindLabel = { sale: 'Sale', expense: 'Expense' };

  const baseData = {
    sums: { inflow: { total: 1000, count: 2 }, outflow: { total: 400, count: 1 } },
    cash: {
      netDay: 600,
      dayTotalIn: 800,
      dayTotalOut: 200,
      availableCashMonthScoped: 5000,
      balanceLifetimeCashVaultsEod: 12000,
    },
    transfers: { count: 1, volume: 50 },
    byKind: [{ kind: 'sale', count: 2, total: 1000 }],
    outflowByPaymentMethod: [{ nameAr: 'نقدي', nameEn: 'Cash', total: 400 }],
    meta: { invoiceCountAll: 3 },
    operations: [
      {
        id: '1',
        invoiceNumber: 'INV-1',
        kind: 'sale',
        totalAmount: 500,
        status: 'active',
        vaultNameAr: 'صندوق',
      },
    ],
  };

  it('includes company, KPIs, and sections', () => {
    const text = buildDayCloseWhatsAppText({
      companyName: 'مطعم',
      dateLabel: '29 May 2026',
      data: baseData,
      kindLabel,
      lang: 'ar',
      t,
    });
    expect(text).toContain('dayCloseWaTitle');
    expect(text).toContain('مطعم');
    expect(text).toContain('1,000');
    expect(text).toContain('نقدي');
    expect(text).toContain('INV-1');
    expect(text).toContain('lifetime 12,000');
  });

  it('omits lifetime footnote when month scoped equals lifetime', () => {
    const text = buildDayCloseWhatsAppText({
      companyName: '',
      dateLabel: '2026-05-29',
      data: {
        ...baseData,
        cash: {
          ...baseData.cash,
          availableCashMonthScoped: 5000,
          balanceLifetimeCashVaultsEod: 5000,
        },
      },
      kindLabel,
      lang: 'en',
      t,
    });
    expect(text).not.toContain('lifetime');
  });
});

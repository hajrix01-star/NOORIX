import { describe, it, expect } from 'vitest';
import {
  SALES_WA,
  waCashLine,
  waChannelRow,
  waCustomersLine,
  waReportHeader,
  waShiftSectionTitle,
  waVaultTypeIcon,
} from './whatsappTextFormat';

describe('whatsappTextFormat', () => {
  it('uses BMP symbols for shift sections', () => {
    const section = waShiftSectionTitle('morning', 'شفت صباحي');
    expect(section).toContain(SALES_WA.morning);
    expect(section).toContain('شفت صباحي');
    expect(section).toContain(SALES_WA.ruleThin);
    expect(section).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('formats channel rows by vault type', () => {
    expect(waChannelRow('بنك', '996', 'bank')).toBe('  ▣ بنك · 996 SR');
    expect(waChannelRow('نقد', '85', 'cash')).toBe('  ¤ نقد · 85 SR');
    expect(waVaultTypeIcon(null, 'بنك الراجحي')).toBe(SALES_WA.bank);
    expect(waVaultTypeIcon(null, 'نقدي')).toBe(SALES_WA.cash);
  });

  it('formats customers and cash lines', () => {
    expect(waCustomersLine('عدد العملاء:', '85')).toBe('  ※ عدد العملاء: 85');
    expect(waCashLine('دخل كاش:', '500 SR')).toBe('  ¤ دخل كاش: 500 SR');
  });

  it('wraps report title in rule lines', () => {
    const h = waReportHeader('تقرير مبيعات يومي', 'ARZ');
    expect(h).toContain('ARZ');
    expect(h.startsWith(SALES_WA.rule)).toBe(true);
  });
});

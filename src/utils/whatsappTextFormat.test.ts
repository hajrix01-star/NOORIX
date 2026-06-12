import { describe, it, expect } from 'vitest';
import {
  SALES_WA,
  salesWaAvgPerCustomer,
  waAppSharePercentLine,
  waAvgSaleMetricLine,
  waChannelRow,
  waMetaLine,
  waReportHeader,
  waShiftSectionTitle,
} from './whatsappTextFormat';

describe('whatsappTextFormat', () => {
  it('uses sales-style emoji shift sections', () => {
    const section = waShiftSectionTitle('morning', 'شفت صباحي');
    expect(section).toContain(SALES_WA.morning);
    expect(section).toContain('شفت صباحي');
  });

  it('formats channel rows with bullet and colon', () => {
    expect(waChannelRow('بنك', '996')).toBe('  • بنك: 996 SR');
  });

  it('formats meta line from translated label', () => {
    expect(waMetaLine('📅 التاريخ:', '28-05-2026')).toBe('📅 التاريخ: 28-05-2026');
  });

  it('puts report title on the first line without a rule separator', () => {
    const h = waReportHeader('📊 تقرير مبيعات يومي', 'ARZ');
    expect(h).toBe('📊 تقرير مبيعات يومي — ARZ');
    expect(h.startsWith(SALES_WA.rule)).toBe(false);
  });

  it('computes average sale as total divided by customers', () => {
    expect(salesWaAvgPerCustomer(1000, 10)).toBe(100);
    expect(salesWaAvgPerCustomer(1000, 0)).toBe(0);
    expect(waAvgSaleMetricLine('🧾 متوسط الفاتورة:', 300, 30)).toBe('  🧾 متوسط الفاتورة: 10 SR');
  });

  it('formats app share percent without amounts', () => {
    expect(waAppSharePercentLine('📱 نسبة التطبيقات (شهر):', 25)).toBe('  📱 نسبة التطبيقات (شهر): 25%');
  });
});

import { describe, it, expect } from 'vitest';
import {
  SALES_WA,
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

  it('wraps report title in rule lines', () => {
    const h = waReportHeader('📊 تقرير مبيعات يومي', 'ARZ');
    expect(h).toContain('ARZ');
    expect(h.startsWith(SALES_WA.rule)).toBe(true);
  });
});

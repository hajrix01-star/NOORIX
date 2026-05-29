import { describe, it, expect } from 'vitest';
import {
  SALES_WA,
  waChannelRow,
  waReportHeader,
  waShiftSectionTitle,
} from './whatsappTextFormat';

describe('whatsappTextFormat', () => {
  it('uses BMP symbols for shift sections', () => {
    const section = waShiftSectionTitle('morning', 'شفت صباحي');
    expect(section).toContain(SALES_WA.morning);
    expect(section).toContain('شفت صباحي');
    expect(section).toContain(SALES_WA.ruleThin);
    expect(section).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('formats channel rows with branch character', () => {
    expect(waChannelRow('بنك', '996')).toBe('  │ بنك · 996 SR');
  });

  it('wraps report title in rule lines', () => {
    const h = waReportHeader('تقرير مبيعات يومي', 'ARZ');
    expect(h).toContain('ARZ');
    expect(h.startsWith(SALES_WA.rule)).toBe(true);
  });
});

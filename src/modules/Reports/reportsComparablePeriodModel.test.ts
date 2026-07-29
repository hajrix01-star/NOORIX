import { describe, expect, it } from 'vitest';
import {
  applyCustomCompareMonths,
  buildCompareColumnPeriods,
  cardAmount,
  periodAmount,
  rowIdentity,
  type ComparablePeriod,
} from './reportsComparablePeriodModel';
import type { GeneralProfitLossGroup, GeneralProfitLossReport, GeneralProfitLossRow, PlDisplayRow } from './reportTypes';

const baseMonths = ['10', '20', '30', '40', '50', '60', '70', '80', '90', '100', '110', '120'];

function row(key: string, total = 780): PlDisplayRow {
  return {
    key,
    groupKey: key,
    labelAr: key,
    labelEn: key,
    rowType: 'group',
    depth: 0,
    months: baseMonths,
    total: String(total),
    percentOfSalesMonths: [],
    percentOfSalesYear: '100',
  };
}

function reportRow(key: string, total = 780): GeneralProfitLossRow {
  return {
    key,
    groupKey: key,
    labelAr: key,
    labelEn: key,
    rowType: 'group',
    depth: 0,
    months: baseMonths,
    total: String(total),
    percentOfSalesMonths: [],
    percentOfSalesYear: '100',
  };
}

function reportGroup(key: string, total = 780): GeneralProfitLossGroup {
  return {
    ...reportRow(key, total),
    items: [],
  };
}

describe('reportsComparablePeriodModel', () => {
  it('totals contiguous and custom month periods from backend report rows', () => {
    const custom = applyCustomCompareMonths(period('months', 2026, 4, 6), [6, 1, 4, 6]);

    expect(periodAmount(row('sales'), period('months', 2026, 4, 6))).toBe(150);
    expect(periodAmount(row('sales'), custom)).toBe(110);
  });

  it('builds comparison columns without aggregating custom months into one column', () => {
    const columns = buildCompareColumnPeriods(
      { ...period('months', 2026, 1, 6), months: [1, 4, 6] },
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      'ignored',
    );

    expect(columns.map((column) => column.label)).toEqual(['Jan 2026', 'Apr 2026', 'Jun 2026']);
    expect(columns.map((column) => column.period.month)).toEqual([1, 4, 6]);
  });

  it('calculates KPI card amounts from the same period contract as table rows', () => {
    const report: GeneralProfitLossReport = {
      amountBasis: 'gross_including_vat',
      months: [],
      groups: [reportGroup('sales')],
      summaryRows: [reportRow('netProfit', 390)],
      cards: { sales: '780', purchases: '0', expenses: '0', grossProfit: '0', netProfit: '390' },
    };

    expect(cardAmount(report, 'sales', period('month', 2026, 2, 2, 2))).toBe(20);
    expect(cardAmount(report, 'netProfit', { ...period('months', 2026, 1, 3), months: [1, 3] })).toBe(40);
    expect(cardAmount(report, 'sales', period('year', 2026, 1, 12))).toBe(780);
  });

  it('keeps row identity stable for comparison maps', () => {
    expect(rowIdentity({ ...row('sales'), itemKey: 'bank', rowType: 'item', depth: 1 })).toBe('sales:bank:item:1');
  });
});

function period(
  mode: ComparablePeriod['mode'],
  year: number,
  monthStart: number,
  monthEnd: number,
  month: number | null = null,
): ComparablePeriod {
  return { mode, year, month, monthStart, monthEnd };
}

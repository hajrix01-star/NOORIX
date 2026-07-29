import { describe, expect, it } from 'vitest';
import {
  buildReportsDetailTabs,
  buildTrendChartRows,
  computeMonthlyAverageAmount,
  findPeakTrendPoint,
  findSelectedTrendPoint,
  reportDetailChannelNames,
  reportDetailItemLabel,
  reportDetailSourceName,
  resolveDisplayAnnualAmount,
  resolveDisplayContextAmount,
  resolveDisplayContextPercent,
  type ReportsDetailData,
  type ReportTrendData,
  type TranslateFn,
} from './reportsDetailModel';

const t: TranslateFn = (key) => key;

describe('reportsDetailModel', () => {
  it('builds tabs from report state and detail kind', () => {
    expect(buildReportsDetailTabs(t, { showTrend: true }, { kind: 'invoices' })).toEqual([
      { id: 'summary', label: 'reportTabSummary' },
      { id: 'trend', label: 'reportTabTrend' },
      { id: 'documents', label: 'reportTabDocuments' },
    ]);

    expect(buildReportsDetailTabs(t, {}, { kind: 'derived' })).toEqual([
      { id: 'summary', label: 'reportTabSummary' },
      { id: 'breakdown', label: 'reportTabBreakdown' },
    ]);
  });

  it('normalizes trend rows without losing raw signed values', () => {
    const trend: ReportTrendData = {
      points: [
        { month: 1, label: 'Jan', amount: -120, percentOfSales: -12.3 },
        { month: 2, label: 'Feb', amount: 80, percentOfSales: 8 },
      ],
    };

    expect(buildTrendChartRows(trend, 1, (value) => `${value}%`)).toEqual([
      { key: '1', name: 'Jan', amount: 120, rawAmount: -120, pctStr: '-12.3%', isSelected: true },
      { key: '2', name: 'Feb', amount: 80, rawAmount: 80, pctStr: '8%', isSelected: false },
    ]);
  });

  it('selects peak and selected points by backend values', () => {
    const trend: ReportTrendData = {
      points: [
        { month: 1, label: 'Jan', amount: -500 },
        { month: 2, label: 'Feb', amount: 300 },
        { month: 3, label: 'Mar', amount: 100 },
      ],
    };

    expect(findPeakTrendPoint(trend)?.month).toBe(2);
    expect(findSelectedTrendPoint(trend, 3)?.label).toBe('Mar');
    expect(findSelectedTrendPoint(trend, 12)).toBeNull();
  });

  it('uses detail values first and falls back to trend when detail values are empty', () => {
    const data: ReportsDetailData = {
      kind: 'invoices',
      contextAmount: 0,
      annualAmount: null,
      contextPercentOfSales: '',
    };
    const trend: ReportTrendData = {
      total: 900,
      points: [{ month: 7, label: 'Jul', amount: 300, percentOfSales: 25 }],
    };
    const selected = findSelectedTrendPoint(trend, 7);

    expect(resolveDisplayContextAmount(data, selected)).toBe('300');
    expect(resolveDisplayAnnualAmount(data, trend)).toBe('900');
    expect(resolveDisplayContextPercent(data, selected)).toBe('25');
  });

  it('computes average over non-empty points only', () => {
    expect(computeMonthlyAverageAmount({
      points: [
        { month: 1, label: 'Jan', amount: 100 },
        { month: 2, label: 'Feb', amount: null },
        { month: 3, label: 'Mar', amount: 300 },
      ],
    })).toBe('200');
  });

  it('resolves labels and channel names for both languages', () => {
    const item = {
      labelAr: 'مواد غذائية',
      labelEn: 'Food',
      supplierNameAr: 'مورد',
      supplierNameEn: 'Supplier',
      channelNames: [
        { nameAr: 'بنك', nameEn: 'Bank' },
        { nameAr: 'نقد', nameEn: 'Cash' },
        { nameAr: 'تطبيق', nameEn: 'App' },
      ],
    };

    expect(reportDetailItemLabel(item, 'ar')).toBe('مواد غذائية');
    expect(reportDetailItemLabel(item, 'en')).toBe('Food');
    expect(reportDetailSourceName(item, 'ar')).toBe('مورد');
    expect(reportDetailSourceName(item, 'en')).toBe('Supplier');
    expect(reportDetailChannelNames(item, 'ar')).toBe('بنك | نقد');
    expect(reportDetailChannelNames(item, 'en')).toBe('Bank | Cash');
  });
});

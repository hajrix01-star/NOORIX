import { describe, expect, it } from 'vitest';
import {
  buildAppSalesTableFooter,
  buildDashboardAppSalesModelFromMetrics,
  buildDashboardAppSalesYearSpanOptions,
  listMonthKeys,
  monthShortLabel,
  parseDashboardAppSalesYearSpan,
} from './dashboardAppSalesData';

describe('dashboardAppSalesData', () => {
  it('normalizes year span filter values and builds picker options', () => {
    const t = (key: string) => key;

    expect(parseDashboardAppSalesYearSpan('2')).toBe(2);
    expect(parseDashboardAppSalesYearSpan(3)).toBe(3);
    expect(parseDashboardAppSalesYearSpan('4')).toBe(1);
    expect(buildDashboardAppSalesYearSpanOptions(t)).toEqual([
      { value: '1', label: 'dashboardAppSalesYears1' },
      { value: '2', label: 'dashboardAppSalesYears2' },
      { value: '3', label: 'dashboardAppSalesYears3' },
    ]);
  });

  it('lists 12 months for one year', () => {
    expect(listMonthKeys(2025, 1)).toHaveLength(12);
    expect(listMonthKeys(2025, 1)[0].periodKey).toBe('2025-01');
    expect(listMonthKeys(2025, 1)[11].periodKey).toBe('2025-12');
  });

  it('builds official app sales from backend metrics', () => {
    const model = buildDashboardAppSalesModelFromMetrics(
      [
        { transactionDate: '2025-04-01', totalAmount: 1000 },
        { transactionDate: '2025-05-01', totalAmount: 500 },
      ],
      [
        { periodKey: '2025-04', vaultId: 'app-jahez', type: 'app', nameAr: 'جاهز', nameEn: 'Jahez', amount: 250 },
        { periodKey: '2025-04', vaultId: 'bank', type: 'bank', nameAr: 'بنك', nameEn: 'Bank', amount: 750 },
        { periodKey: '2025-05', vaultId: 'app-jahez', type: 'app', nameAr: 'جاهز', nameEn: 'Jahez', amount: 100 },
        { periodKey: '2025-05', vaultId: 'app-hunger', type: 'app', nameAr: 'هنقر', nameEn: 'Hunger', amount: 50 },
      ],
      'ar',
      2025,
      1,
    );

    expect(model.periodTotal).toBe(1500);
    expect(model.periodApp).toBe(400);
    expect(model.periodAppPercent).toBeCloseTo((400 / 1500) * 100, 5);
    expect(model.channels.map((channel) => channel.id)).toEqual(['app-jahez', 'app-hunger']);
    expect(model.channels[0].months['2025-04'].percent).toBe(25);

    const apr = model.monthSeries.find((point) => point.periodKey === '2025-04');
    expect(apr?.shortLabel).toBe('4');
    expect(monthShortLabel(2025, 4, 'en', 2)).toBe("Apr'25");

    const footer = buildAppSalesTableFooter(model);
    const aprFooter = footer.monthCells.find((cell) => cell.periodKey === '2025-04');
    expect(aprFooter?.appPercent).toBe(25);
    expect(footer.periodPercent).toBeCloseTo((400 / 1500) * 100, 5);
  });

  it('does not invent official app sales when backend metrics are absent', () => {
    const model = buildDashboardAppSalesModelFromMetrics(undefined, undefined, 'ar', 2025, 1);

    expect(model.hasData).toBe(false);
    expect(model.periodTotal).toBe(0);
    expect(model.periodApp).toBe(0);
    expect(model.channels).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  buildAppSalesTableFooter,
  buildDashboardAppSalesDisplayModelFromBackend,
  buildDashboardAppSalesYearSpanOptions,
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

  it('maps backend app-sales metrics to display labels without recalculating values', () => {
    const model = buildDashboardAppSalesDisplayModelFromBackend(
      {
        monthSeries: [
          { year: 2025, month: 4, periodKey: '2025-04', total: 1000, app: 250, appPercent: 25 },
          { year: 2025, month: 5, periodKey: '2025-05', total: 500, app: 150, appPercent: 30 },
        ],
        channels: [
          {
            id: 'app-jahez',
            nameAr: 'جاهز',
            nameEn: 'Jahez',
            periodAmount: 350,
            periodPercent: 23.333,
            months: {
              '2025-04': { amount: 250, percent: 25 },
              '2025-05': { amount: 100, percent: 20 },
            },
          },
        ],
        periodTotal: 1500,
        periodApp: 400,
        periodAppPercent: 26.666,
        hasData: true,
      },
      'ar',
      1,
    );

    expect(model.periodTotal).toBe(1500);
    expect(model.periodAppPercent).toBe(26.666);
    expect(model.channels[0].name).toBe('جاهز');
    expect(model.channels[0].months['2025-04'].percent).toBe(25);
    expect(model.monthSeries[0].shortLabel).toBe('4');
    expect(monthShortLabel(2025, 4, 'en', 2)).toBe("Apr'25");

    const footer = buildAppSalesTableFooter(model);
    expect(footer.monthCells[0].appPercent).toBe(25);
    expect(footer.periodPercent).toBe(26.666);
  });

  it('does not invent app-sales values when backend model is absent', () => {
    const model = buildDashboardAppSalesDisplayModelFromBackend(undefined, 'ar', 1);

    expect(model.hasData).toBe(false);
    expect(model.periodTotal).toBe(0);
    expect(model.periodApp).toBe(0);
    expect(model.channels).toEqual([]);
  });
});

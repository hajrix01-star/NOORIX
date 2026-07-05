import { describe, expect, it } from 'vitest';
import {
  buildDashboardAppSalesYearSpanOptions,
  buildAppSalesTableFooter,
  buildDashboardAppSalesModel,
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

  it('aggregates app share per month and per channel', () => {
    const model = buildDashboardAppSalesModel(
      [
        {
          transactionDate: '2025-04-15',
          totalAmount: 1000,
          channels: [
            { amount: 300, vault: { type: 'app', nameAr: 'جاهز', nameEn: 'Jahez' } },
            { amount: 700, vault: { type: 'bank', nameAr: 'بنك', nameEn: 'Bank' } },
          ],
        },
        {
          transactionDate: '2025-05-10',
          totalAmount: 500,
          channels: [{ amount: 100, vault: { type: 'app', nameAr: 'هنقر', nameEn: 'Hunger' } }],
        },
      ],
      'ar',
      2025,
      1,
    );

    const apr = model.monthSeries.find((p) => p.periodKey === '2025-04');
    const may = model.monthSeries.find((p) => p.periodKey === '2025-05');
    expect(apr?.shortLabel).toBe('4');
    expect(monthShortLabel(2025, 4, 'en', 2)).toBe("Apr'25");
    expect(apr?.appPercent).toBe(30);
    expect(may?.appPercent).toBe(20);
    expect(model.periodAppPercent).toBeCloseTo((400 / 1500) * 100, 5);

    const jahez = model.channels.find((c) => c.name === 'جاهز');
    expect(jahez?.months['2025-04'].percent).toBe(30);
    expect(jahez?.periodPercent).toBeCloseTo((300 / 1500) * 100, 5);

    const footer = buildAppSalesTableFooter(model);
    const aprFooter = footer.monthCells.find((c) => c.periodKey === '2025-04');
    expect(aprFooter?.appPercent).toBe(30);
    expect(footer.periodPercent).toBeCloseTo((400 / 1500) * 100, 5);
  });
});

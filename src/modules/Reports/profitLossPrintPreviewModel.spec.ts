import { describe, expect, it } from 'vitest';
import { buildFlatRows } from './reportHelpers';
import { buildProfitLossPrintPreviewDocument } from './profitLossPrintPreviewModel';
import type { GeneralProfitLossReport } from './reportTypes';

const t = (key: string) =>
  ({
    reportGeneral: 'General report',
    reportItem: 'Item',
    reportAnnualTotal: 'Annual total',
    reportSalesShareYear: 'Sales share',
  })[key] ?? key;

const report: GeneralProfitLossReport = {
  amountBasis: 'gross_including_vat',
  months: [{ index: 1, label: 'Jan' }],
  groups: [
    {
      key: 'sales',
      labelAr: 'المبيعات',
      labelEn: 'Sales',
      months: ['100'],
      total: '100',
      percentOfSalesMonths: ['100'],
      percentOfSalesYear: '100',
      items: [
        {
          key: 'bank',
          labelAr: 'بنك',
          labelEn: 'Bank',
          months: ['100'],
          total: '100',
          percentOfSalesMonths: ['100'],
          percentOfSalesYear: '100',
        },
      ],
    },
    {
      key: 'expenses',
      labelAr: 'المصاريف',
      labelEn: 'Expenses',
      months: ['20'],
      total: '20',
      percentOfSalesMonths: ['20'],
      percentOfSalesYear: '20',
      items: [
        {
          key: 'category:food',
          labelAr: 'مواد غذائية',
          labelEn: 'Food',
          months: ['20'],
          total: '20',
          percentOfSalesMonths: ['20'],
          percentOfSalesYear: '20',
          children: [
            {
              key: 'meat',
              labelAr: 'لحوم',
              labelEn: 'Meat',
              months: ['20'],
              total: '20',
              percentOfSalesMonths: ['20'],
              percentOfSalesYear: '20',
            },
          ],
        },
      ],
    },
  ],
  summaryRows: [],
  cards: {
    sales: '100',
    purchases: '0',
    expenses: '20',
    grossProfit: '100',
    netProfit: '80',
  },
};

describe('profitLossPrintPreviewModel', () => {
  it('renders profit and loss print rows with a visual tree depth', () => {
    const document = buildProfitLossPrintPreviewDocument({
      activePeriodColumns: [],
      companyLogoUrl: '',
      companyName: 'ARZ',
      compareColumnPeriods: [],
      compareRows: new Map(),
      currentColumnPeriod: null,
      lang: 'ar',
      reportTitle: 'قائمة الدخل',
      reportsFallbackTitle: 'التقارير',
      rows: buildFlatRows(report, {}),
      t,
      year: 2026,
    });

    expect(document.body).toContain('pl-print-row-group pl-print-depth-0');
    expect(document.body).toContain('pl-print-row-item pl-print-depth-1');
    expect(document.body).toContain('pl-print-row-category pl-print-depth-1');
    expect(document.body).toContain('pl-print-row-item pl-print-depth-2');
    expect(document.body).toContain('pl-print-tree-marker');
    expect(document.extraCss).toContain('.pl-print-label-inner');
  });
});

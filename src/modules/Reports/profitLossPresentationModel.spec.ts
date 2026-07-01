import { describe, expect, it } from 'vitest';
import {
  buildProfitLossKpiCards,
  getProfitLossCardRawValue,
  getProfitLossMonthNames,
} from './profitLossPresentationModel';
import type { GeneralProfitLossReport } from './reportTypes';

const t = (key: string) =>
  ({
    revenueGroup: 'Revenue',
    purchasesGroup: 'Purchases',
    expensesGroup: 'Expenses',
    annualSales: 'Annual sales',
    annualPurchases: 'Annual purchases',
    annualExpenses: 'Annual expenses',
    annualGrossProfit: 'Gross profit',
    annualNetProfit: 'Net profit',
  })[key] ?? key;

const report: GeneralProfitLossReport = {
  amountBasis: 'gross_including_vat',
  months: [
    { index: 1, label: 'Jan' },
    { index: 2, label: 'Feb' },
  ],
  groups: [
    {
      key: 'sales',
      labelAr: 'المبيعات',
      labelEn: 'Sales',
      months: ['100', '200'],
      total: '300',
      percentOfSalesMonths: ['100', '100'],
      percentOfSalesYear: '100',
      items: [],
    },
    {
      key: 'purchases',
      labelAr: 'المشتريات',
      labelEn: 'Purchases',
      months: ['20', '40'],
      total: '60',
      percentOfSalesMonths: ['20', '20'],
      percentOfSalesYear: '20',
      items: [],
    },
    {
      key: 'expenses',
      labelAr: 'المصاريف',
      labelEn: 'Expenses',
      months: ['10', '30'],
      total: '40',
      percentOfSalesMonths: ['10', '15'],
      percentOfSalesYear: '13.3',
      items: [],
    },
  ],
  summaryRows: [
    {
      key: 'grossProfit',
      labelAr: 'الربح الإجمالي',
      labelEn: 'Gross profit',
      months: ['80', '160'],
      total: '240',
      percentOfSalesMonths: ['80', '80'],
      percentOfSalesYear: '80',
    },
    {
      key: 'netProfit',
      labelAr: 'الربح الصافي',
      labelEn: 'Net profit',
      months: ['70', '130'],
      total: '200',
      percentOfSalesMonths: ['70', '65'],
      percentOfSalesYear: '66.7',
    },
  ],
  cards: {
    sales: '300',
    purchases: '60',
    expenses: '40',
    grossProfit: '240',
    netProfit: '200',
  },
};

describe('profitLossPresentationModel', () => {
  it('uses report card totals in annual mode and row month values in monthly mode', () => {
    expect(getProfitLossCardRawValue(report, 'sales', null)).toBe(300);
    expect(getProfitLossCardRawValue(report, 'sales', 2)).toBe(200);
    expect(getProfitLossCardRawValue(report, 'netProfit', 2)).toBe(130);
  });

  it('builds stable KPI cards for year and selected month', () => {
    const annualCards = buildProfitLossKpiCards({ report, selectedMonthNumber: null, lang: 'en', year: 2026, t });
    const monthCards = buildProfitLossKpiCards({ report, selectedMonthNumber: 2, lang: 'en', year: 2026, t });

    expect(annualCards.map((card) => card.key)).toEqual(['sales', 'purchases', 'expenses', 'grossProfit', 'netProfit']);
    expect(annualCards.find((card) => card.key === 'sales')).toMatchObject({
      label: 'Annual sales',
      rawValue: 300,
      periodLabel: '2026',
    });
    expect(monthCards.find((card) => card.key === 'sales')).toMatchObject({
      label: 'February — Revenue',
      rawValue: 200,
      periodLabel: 'February · 2026',
    });
    expect(monthCards.find((card) => card.key === 'netProfit')?.profitPercent).toBe('65');
  });

  it('returns localized month names for Arabic and English layouts', () => {
    expect(getProfitLossMonthNames('ar')[0]).toBe('يناير');
    expect(getProfitLossMonthNames('en')[0]).toBe('January');
  });
});

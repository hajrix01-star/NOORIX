import { buildOwnerOverviewModel, type OwnerOverviewCompanyReport } from './owner-overview-model.util';
import type { GeneralProfitLossModel } from '../reports/reports-general-profit-loss-model.util';

function report(input: {
  sales: number[];
  purchases: number[];
  expenses: number[];
  netProfit: number[];
}): GeneralProfitLossModel {
  const total = (values: number[]) => String(values.reduce((sum, value) => sum + value, 0));
  return {
    amountBasis: 'gross_including_vat',
    months: Array.from({ length: 12 }, (_, index) => ({ index: index + 1, label: String(index + 1) })),
    groups: [
      { key: 'sales', labelAr: 'Sales', labelEn: 'Sales', months: input.sales.map(String), total: total(input.sales), percentOfSalesMonths: [], percentOfSalesYear: '0', items: [] },
      { key: 'purchases', labelAr: 'Purchases', labelEn: 'Purchases', months: input.purchases.map(String), total: total(input.purchases), percentOfSalesMonths: [], percentOfSalesYear: '0', items: [] },
      { key: 'expenses', labelAr: 'Expenses', labelEn: 'Expenses', months: input.expenses.map(String), total: total(input.expenses), percentOfSalesMonths: [], percentOfSalesYear: '0', items: [] },
    ],
    summaryRows: [
      { key: 'netProfit', labelAr: 'Net profit', labelEn: 'Net profit', months: input.netProfit.map(String), total: total(input.netProfit), percentOfSalesMonths: [], percentOfSalesYear: '0' },
    ],
    cards: {
      sales: total(input.sales),
      purchases: total(input.purchases),
      expenses: total(input.expenses),
      grossProfit: total(input.sales),
      netProfit: total(input.netProfit),
    },
  };
}

const zeros = Array(12).fill(0) as number[];

describe('buildOwnerOverviewModel', () => {
  it('builds official owner totals, ratios, comparison rows, and export rows in backend model', () => {
    const companies: OwnerOverviewCompanyReport[] = [
      {
        company: { id: 'c1', nameAr: 'A', nameEn: 'A' },
        report: report({
          sales: [1000, ...zeros.slice(1)],
          purchases: [400, ...zeros.slice(1)],
          expenses: [100, ...zeros.slice(1)],
          netProfit: [500, ...zeros.slice(1)],
        }),
        dailySales: [],
      },
      {
        company: { id: 'c2', nameAr: 'B', nameEn: 'B' },
        report: report({
          sales: [500, ...zeros.slice(1)],
          purchases: [100, ...zeros.slice(1)],
          expenses: [50, ...zeros.slice(1)],
          netProfit: [350, ...zeros.slice(1)],
        }),
        dailySales: [],
      },
    ];

    const model = buildOwnerOverviewModel({ year: 2026, month: null, companies });

    expect(model.kpis.find((kpi) => kpi.key === 'sales')?.total).toBe(1500);
    expect(model.kpis.find((kpi) => kpi.key === 'purchases')?.percentOfSales).toBe(33.33);
    expect(model.monthlyBuckets[0]).toMatchObject({ sales: 1500, purchases: 500, expenses: 150, netProfit: 850 });
    expect(model.comparison.sales.grandTotal).toBe(1500);
    expect(model.comparison.sales.rows[0].shareOfGrandTotalPct).toBe(66.67);
    expect(model.exportRows[0]).toMatchObject({ companyId: 'total', sales: 1500, netProfit: 850 });
  });

  it('builds daily performance from non-cancelled daily sales only', () => {
    const companies: OwnerOverviewCompanyReport[] = [
      {
        company: { id: 'c1', nameAr: 'A', nameEn: null },
        report: report({ sales: zeros, purchases: zeros, expenses: zeros, netProfit: zeros }),
        dailySales: [
          { transactionDate: '2026-07-01', status: 'posted', totalAmount: '200' },
          { transactionDate: '2026-07-01', status: 'cancelled', totalAmount: '999' },
          { transactionDate: '2026-07-02', status: null, totalAmount: '50' },
        ],
      },
    ];

    const model = buildOwnerOverviewModel({ year: 2026, month: 7, companies });

    expect(model.dailyPerformance[0].c1).toBe(200);
    expect(model.dailyPerformance[1].c1).toBe(50);
    expect(model.dailyPerformance).toHaveLength(31);
  });
});

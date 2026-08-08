import type { GeneralProfitLossModel } from '../../../reports/reports-general-profit-loss-model.util';
import { ExpenseInsightsService } from './expense-insights.service';
import type { DashboardSummaryDateRange } from '../../reporting.facade';

describe('ExpenseInsightsService', () => {
  const dateRange: DashboardSummaryDateRange = {
    year: 2026,
    yearStart: '2026-01-01',
    yearEnd: '2026-12-31',
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
  };

  it('calls ReportingFacade.getDashboardSummary exactly once', async () => {
    const getDashboardSummary = jest.fn().mockResolvedValue({
      profitLoss: null,
      salesPack: {},
      periodAnalytics: {},
    });
    const facade = { getDashboardSummary };
    const svc = new ExpenseInsightsService(facade);
    await svc.buildExpenseInsights('c1', dateRange, null);
    expect(getDashboardSummary).toHaveBeenCalledTimes(1);
    expect(getDashboardSummary).toHaveBeenCalledWith('c1', dateRange);
  });

  it('returns schemaVersion 1, generatedAt, and stable warning order', async () => {
    const expMonths = Array(12).fill('0');
    expMonths[1] = '10';
    expMonths[2] = '10';
    expMonths[3] = '100';
    const salesMonths = Array(12).fill('0');
    salesMonths[3] = '1000';
    const pl: GeneralProfitLossModel = {
      amountBasis: 'gross_including_vat',
      months: [],
      groups: [
        {
          key: 'sales',
          labelAr: 's',
          labelEn: 's',
          months: salesMonths,
          total: '0',
          percentOfSalesMonths: Array(12).fill('0'),
          percentOfSalesYear: '0',
          items: [],
        },
        {
          key: 'expenses',
          labelAr: 'e',
          labelEn: 'e',
          months: expMonths,
          total: '0',
          percentOfSalesMonths: Array(12).fill('0'),
          percentOfSalesYear: '0',
          items: [
            {
              key: 'category:big',
              labelAr: 'Big',
              labelEn: 'Big',
              months: Array.from({ length: 12 }, (_, i) => (i === 3 ? '50' : '0')),
              total: '0',
              percentOfSalesMonths: Array(12).fill('0'),
              percentOfSalesYear: '0',
            },
            {
              key: 'category:small',
              labelAr: 'S',
              labelEn: 'S',
              months: Array.from({ length: 12 }, (_, i) => (i === 3 ? '30' : '0')),
              total: '0',
              percentOfSalesMonths: Array(12).fill('0'),
              percentOfSalesYear: '0',
            },
            {
              key: 'kind:expense',
              labelAr: 'k',
              labelEn: 'k',
              months: Array.from({ length: 12 }, (_, i) => (i === 3 ? '20' : '0')),
              total: '0',
              percentOfSalesMonths: Array(12).fill('0'),
              percentOfSalesYear: '0',
            },
            {
              key: 'kind:fixed_expense',
              labelAr: 'f',
              labelEn: 'f',
              months: Array.from({ length: 12 }, (_, i) => (i === 3 ? '300' : '0')),
              total: '0',
              percentOfSalesMonths: Array(12).fill('0'),
              percentOfSalesYear: '0',
            },
          ],
        },
      ],
      summaryRows: [],
      cards: { sales: '0', purchases: '0', expenses: '0', grossProfit: '0', netProfit: '0' },
    };
    const getDashboardSummary = jest.fn().mockResolvedValue({
      profitLoss: pl,
      salesPack: {},
      periodAnalytics: {},
    });
    const facade = { getDashboardSummary };
    const svc = new ExpenseInsightsService(facade);
    const out = await svc.buildExpenseInsights('c1', dateRange, 4);
    expect(out.schemaVersion).toBe(1);
    expect(out.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(out.warnings.map((w) => w.id)).toEqual([
      'top_expense_category_share_warning',
      'missing_expense_category_warning',
      'unusual_expense_spike_warning',
      'fixed_expense_pressure_warning',
    ]);
  });

  it('does not crash when profitLoss is missing', async () => {
    const getDashboardSummary = jest.fn().mockResolvedValue({
      profitLoss: null,
      salesPack: {},
      periodAnalytics: {},
    });
    const facade = { getDashboardSummary };
    const svc = new ExpenseInsightsService(facade);
    const out = await svc.buildExpenseInsights('c1', dateRange, 6);
    expect(out.warnings).toEqual([]);
  });

  it('uses the consolidated recurring-expense total for a selected calendar month', async () => {
    const salesMonths = Array(12).fill('0');
    salesMonths[2] = '100';
    const pl: GeneralProfitLossModel = {
      amountBasis: 'gross_including_vat',
      months: [],
      groups: [
        { key: 'sales', labelAr: 'sales', labelEn: 'sales', months: salesMonths, total: '0', percentOfSalesMonths: Array(12).fill('0'), percentOfSalesYear: '0', items: [] },
        { key: 'expenses', labelAr: 'expenses', labelEn: 'expenses', months: Array(12).fill('0'), total: '0', percentOfSalesMonths: Array(12).fill('0'), percentOfSalesYear: '0', items: [] },
      ],
      summaryRows: [],
      cards: { sales: '0', purchases: '0', expenses: '0', grossProfit: '0', netProfit: '0' },
    };
    const facade = {
      getDashboardSummary: jest.fn().mockResolvedValue({
        profitLoss: pl,
        salesPack: {},
        periodAnalytics: { fixedExpenseTotal: '30' },
      }),
    };

    const out = await new ExpenseInsightsService(facade).buildExpenseInsights('c1', dateRange, 3);

    expect(out.warnings.find((warning) => warning.id === 'fixed_expense_pressure_warning')?.values)
      .toMatchObject({ fixedExpenses: 30, fixedToSales: 0.3 });
    expect(out.context.labels.fixedExpenseScope).toBe('invoice_period_recurring_expenses_including_recurring_hr');
  });
});

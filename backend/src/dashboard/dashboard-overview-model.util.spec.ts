import { buildDashboardLedgerSalesAverage, buildKpiCards, buildLedgerKpiCards } from './dashboard-overview-model.util';

describe('buildKpiCards', () => {
  it('includes salaries in custom-range operating expenses and outflow', () => {
    const cards = buildKpiCards({
      report: null,
      periodData: {
        totalsByKind: {
          purchase: { totalAmount: '100' },
          expense: { totalAmount: '200' },
          fixed_expense: { totalAmount: '50' },
          hr_expense: { totalAmount: '50' },
          salary: { totalAmount: '600' },
        },
      },
      dailyRows: [{ transactionDate: '2026-08-01', totalAmount: 1000, customerCount: 10 }],
      selectedMonth: null,
      isCustomRange: true,
    });

    expect(cards.find((card) => card.key === 'expenses')?.value).toBe(900);
    expect(cards.find((card) => card.key === 'outflow')?.value).toBe(1000);
  });
});

describe('buildLedgerKpiCards', () => {
  it('includes payroll and collected VAT, without accepting non-operating movements as costs', () => {
    const cards = buildLedgerKpiCards({
      sales: '1000', taxCollected: '150', purchases: '300', recurringExpenses: '100',
      otherExpenses: '50', payroll: '150', operatingCosts: '600', operatingResult: '400',
    });

    expect(cards).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'sales', value: 1150 }),
      expect.objectContaining({ key: 'expenses', value: 300 }),
      expect.objectContaining({ key: 'outflow', value: 600 }),
      expect.objectContaining({ key: 'netProfit', value: 550 }),
    ]));
  });
});

describe('buildDashboardLedgerSalesAverage', () => {
  it('uses ledger gross sales for monetary averages and operational data only for denominators', () => {
    const average = buildDashboardLedgerSalesAverage(
      { sales: '1000', taxCollected: '150' },
      { customerCount: 10, calendarDays: 5 },
    );

    expect(average).toEqual({
      total: 1150,
      customerCount: 10,
      calendarDays: 5,
      revenueAvgDaily: 230,
      customerAvgDaily: 2,
      basketAvg: 115,
    });
  });

  it('does not accept a sales-summary amount as a monetary fallback', () => {
    expect(buildDashboardLedgerSalesAverage(
      { sales: '0', taxCollected: '0' },
      { customerCount: 4, calendarDays: 2 },
    )?.total).toBe(0);
  });
});

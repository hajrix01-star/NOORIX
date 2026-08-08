import { buildKpiCards } from './dashboard-overview-model.util';

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

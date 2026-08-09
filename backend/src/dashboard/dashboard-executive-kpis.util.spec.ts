import { buildDashboardExecutiveKpis } from './dashboard-executive-kpis.util';

describe('buildDashboardExecutiveKpis', () => {
  it('keeps the overview cost card reconciled with its three operating sections', () => {
    const cards = buildDashboardExecutiveKpis([
      { key: 'sales', value: 1000, pct: 100, tone: 'neutral' },
      { key: 'purchases', value: 0, pct: null, tone: 'cost' },
      { key: 'expenses', value: 0, pct: null, tone: 'cost' },
      { key: 'outflow', value: 0, pct: null, tone: 'cost' },
      { key: 'grossProfit', value: 0, pct: null, tone: 'positive' },
      { key: 'netProfit', value: 0, pct: null, tone: 'positive' },
    ], {
      purchases: { amount: '400' },
      recurringCosts: { amount: '300' },
      otherExpenses: { amount: '50' },
      operatingCosts: { amount: '750' },
    });

    expect(cards.find((card) => card.key === 'outflow')?.value).toBe(750);
    expect(cards.find((card) => card.key === 'purchases')?.value).toBe(400);
    expect(cards.find((card) => card.key === 'expenses')?.value).toBe(350);
    expect(cards.find((card) => card.key === 'netProfit')?.value).toBe(250);
  });
});

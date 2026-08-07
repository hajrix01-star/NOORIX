import { buildDashboardOperationalOverview } from './dashboard-operational-overview.util';

describe('buildDashboardOperationalOverview', () => {
  it('reuses period totals and purchase category shares in one presentation model', () => {
    const result = buildDashboardOperationalOverview(
      {
        totalsByKind: {
          fixed_expense: { totalAmount: '2000', invoiceCount: 3 },
        },
        purchaseCategoryTotal: '3000',
        purchaseCategoryBreakdown: [
          { categoryId: 'food', nameAr: 'مواد غذائية', amount: '1800', sharePct: 60 },
          { categoryId: 'other', nameAr: 'أخرى', amount: '1200', sharePct: 40 },
        ],
      },
      [{ key: 'sales', value: 10000 }],
    );

    expect(result).toEqual({
      sales: '10000',
      fixedExpenses: { amount: '2000', invoiceCount: 3, shareOfSalesPct: 20 },
      purchases: {
        amount: '3000',
        shareOfSalesPct: 30,
        categories: [
          { categoryId: 'food', nameAr: 'مواد غذائية', amount: '1800', sharePct: 60 },
          { categoryId: 'other', nameAr: 'أخرى', amount: '1200', sharePct: 40 },
        ],
      },
    });
  });

  it('does not produce a misleading percentage when sales are zero', () => {
    const result = buildDashboardOperationalOverview(
      {
        totalsByKind: { fixed_expense: { totalAmount: '500', invoiceCount: 1 } },
        purchaseCategoryTotal: '250',
      },
      [{ key: 'sales', value: 0 }],
    );

    expect(result.fixedExpenses.shareOfSalesPct).toBeNull();
    expect(result.purchases.shareOfSalesPct).toBeNull();
  });
});

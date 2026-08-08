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
        recurringCostCategoryBreakdown: [
          {
            id: 'rent', nameAr: 'إيجار', amount: '2000', sharePct: 100,
          },
        ],
        otherExpenseTotal: '500',
        otherExpenseCategoryBreakdown: [{ id: 'maintenance', nameAr: 'صيانة', amount: '500', sharePct: 100 }],
      },
      [{ key: 'sales', value: 10000 }],
    );

    expect(result).toEqual({
      sales: '10000',
      recurringCosts: {
        amount: '2000', recordCount: 3, shareOfSalesPct: 20,
        categories: [{ id: 'rent', nameAr: 'إيجار', amount: '2000', sharePct: 100 }],
      },
      otherExpenses: {
        amount: '500', shareOfSalesPct: 5,
        categories: [{ id: 'maintenance', nameAr: 'صيانة', amount: '500', sharePct: 100 }],
      },
      purchases: {
        amount: '3000',
        shareOfSalesPct: 30,
        categories: [
          { categoryId: 'food', nameAr: 'مواد غذائية', amount: '1800', sharePct: 60 },
          { categoryId: 'other', nameAr: 'أخرى', amount: '1200', sharePct: 40 },
        ],
      },
      operatingCosts: { amount: '5500', shareOfSalesPct: 55 },
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

    expect(result.recurringCosts.shareOfSalesPct).toBeNull();
    expect(result.otherExpenses.shareOfSalesPct).toBeNull();
    expect(result.operatingCosts.shareOfSalesPct).toBeNull();
    expect(result.purchases.shareOfSalesPct).toBeNull();
  });

  it('reconciles purchases, recurring costs, and other expenses into one operating-cost total', () => {
    const result = buildDashboardOperationalOverview(
      {
        totalsByKind: { fixed_expense: { totalAmount: '200', invoiceCount: 1 } },
        purchaseCategoryTotal: '250',
        fixedExpenseTotal: '550',
        fixedExpenseInvoiceCount: 3,
        otherExpenseTotal: '250',
      },
      [{ key: 'sales', value: 1100 }],
    );

    expect(result.recurringCosts.amount).toBe('550');
    expect(result.recurringCosts.recordCount).toBe(3);
    expect(result.recurringCosts.shareOfSalesPct).toBe(50);
    expect(result.otherExpenses.amount).toBe('250');
    expect(result.operatingCosts.amount).toBe('1050');
    expect(result.operatingCosts.shareOfSalesPct).toBeCloseTo(95.45, 2);
  });
});

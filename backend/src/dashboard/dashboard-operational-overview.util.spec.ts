import { buildDashboardOperationalOverview } from './dashboard-operational-overview.util';

const ledger = (overrides: Record<string, unknown> = {}) => ({
  sales: '1000', taxCollected: '150', purchases: '300', recurringExpenses: '100', otherExpenses: '50', payroll: '150',
  operatingCosts: '600', operatingResult: '550',
  categories: {
    purchases: [{ id: 'food', categoryId: 'food', nameAr: 'مواد غذائية', nameEn: 'Food', amount: '300.0000', sharePct: 100 }],
    recurringExpenses: [{ id: 'rent', categoryId: 'rent', nameAr: 'إيجار', nameEn: 'Rent', amount: '100.0000', sharePct: 100 }],
    otherExpenses: [{ id: 'maintenance', categoryId: 'maintenance', nameAr: 'صيانة', nameEn: 'Maintenance', amount: '50.0000', sharePct: 100 }],
    payroll: [{ id: '__payroll__', categoryId: null, nameAr: 'رواتب وأجور', nameEn: 'Payroll and wages', amount: '150.0000', sharePct: 100 }],
  },
  reportingClassRecordCounts: {
    operating_revenue: 1, operating_purchase: 1, operating_recurring_expense: 2,
    operating_other_expense: 1, operating_payroll: 3, non_operating_advance: 0,
    non_operating_loan: 0, non_operating_payroll_payment: 0,
    internal_transfer: 0, tax_collected: 1, unclassified: 0,
  },
  ...overrides,
});

describe('buildDashboardOperationalOverview ledger-only', () => {
  it('builds all monetary sections and category rows from the classified ledger', () => {
    const result = buildDashboardOperationalOverview(
      { purchaseCategoryTotal: '999999', fixedExpenseTotal: '999999', otherExpenseTotal: '999999' },
      [{ key: 'sales', value: 1 }],
      ledger(),
    );

    expect(result.sales).toBe('1150');
    expect(result.purchases.amount).toBe('300');
    expect(result.purchases.categories[0]).toMatchObject({ categoryId: 'food', amount: '300.0000' });
    expect(result.recurringCosts.amount).toBe('250');
    expect(result.recurringCosts.recordCount).toBe(5);
    expect(result.recurringCosts.categories.map((row) => row.nameAr)).toEqual(['رواتب وأجور', 'إيجار']);
    expect(result.recurringCosts.categories.map((row) => row.sharePct)).toEqual([60, 40]);
    expect(result.otherExpenses.amount).toBe('50');
    expect(result.operatingCosts.amount).toBe('600');
  });

  it('does not produce misleading percentages when ledger sales are zero', () => {
    const result = buildDashboardOperationalOverview(null, [{ key: 'sales', value: 999 }], ledger({ sales: '0', taxCollected: '0' }));
    expect(result.recurringCosts.shareOfSalesPct).toBeNull();
    expect(result.otherExpenses.shareOfSalesPct).toBeNull();
    expect(result.operatingCosts.shareOfSalesPct).toBeNull();
    expect(result.purchases.shareOfSalesPct).toBeNull();
  });

  it('fails closed when a classified ledger projection is missing', () => {
    expect(() => buildDashboardOperationalOverview(null, [], undefined as never))
      .toThrow('Classified ledger projection is required');
  });
});

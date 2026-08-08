import Decimal from 'decimal.js';

type PeriodKindTotal = {
  totalAmount?: string | number | null;
  invoiceCount?: number | null;
};

type PurchaseCategoryRow = {
  id?: string | null;
  categoryId?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  amount?: string | number | null;
  sharePct?: number | null;
};

type CostCategoryRow = {
  id?: string | null;
  categoryId?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  amount?: string | number | null;
  sharePct?: number | null;
};

type PeriodData = {
  totalsByKind?: Record<string, PeriodKindTotal>;
  purchaseCategoryBreakdown?: PurchaseCategoryRow[];
  purchaseCategoryTotal?: string | number | null;
  fixedExpenseTotal?: string | number | null;
  fixedExpenseInvoiceCount?: number | null;
  recurringCostCategoryBreakdown?: CostCategoryRow[];
  otherExpenseCategoryBreakdown?: CostCategoryRow[];
  otherExpenseTotal?: string | number | null;
} | null;

type KpiCard = {
  key: string;
  value: number;
};

function percentageOf(value: Decimal, total: Decimal): number | null {
  if (total.isZero()) return null;
  return value.div(total).mul(100).toDecimalPlaces(2).toNumber();
}

export function buildDashboardOperationalOverview(
  periodData: PeriodData,
  kpiCards: readonly KpiCard[],
) {
  const salesCard = kpiCards.find((row) => row.key === 'sales');
  const sales = new Decimal(salesCard?.value || 0);
  const fixedExpenseKind = periodData?.totalsByKind?.fixed_expense;
  const recurringCosts = new Decimal(periodData?.fixedExpenseTotal ?? fixedExpenseKind?.totalAmount ?? 0);
  const purchases = new Decimal(periodData?.purchaseCategoryTotal || 0);
  const otherExpenses = new Decimal(periodData?.otherExpenseTotal ?? 0);
  const operatingCosts = purchases.plus(recurringCosts).plus(otherExpenses);

  return {
    sales: sales.toString(),
    recurringCosts: {
      amount: recurringCosts.toString(),
      recordCount: periodData?.fixedExpenseInvoiceCount ?? fixedExpenseKind?.invoiceCount ?? 0,
      shareOfSalesPct: percentageOf(recurringCosts, sales),
      categories: periodData?.recurringCostCategoryBreakdown ?? [],
    },
    otherExpenses: {
      amount: otherExpenses.toString(),
      shareOfSalesPct: percentageOf(otherExpenses, sales),
      categories: periodData?.otherExpenseCategoryBreakdown ?? [],
    },
    purchases: {
      amount: purchases.toString(),
      shareOfSalesPct: percentageOf(purchases, sales),
      categories: periodData?.purchaseCategoryBreakdown ?? [],
    },
    operatingCosts: {
      amount: operatingCosts.toString(),
      shareOfSalesPct: percentageOf(operatingCosts, sales),
    },
  };
}

import Decimal from 'decimal.js';

type PeriodKindTotal = {
  totalAmount?: string | number | null;
  invoiceCount?: number | null;
};

type PurchaseCategoryRow = {
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
  const fixedExpenses = new Decimal(fixedExpenseKind?.totalAmount || 0);
  const purchases = new Decimal(periodData?.purchaseCategoryTotal || 0);

  return {
    sales: sales.toString(),
    fixedExpenses: {
      amount: fixedExpenses.toString(),
      invoiceCount: fixedExpenseKind?.invoiceCount ?? 0,
      shareOfSalesPct: percentageOf(fixedExpenses, sales),
    },
    purchases: {
      amount: purchases.toString(),
      shareOfSalesPct: percentageOf(purchases, sales),
      categories: periodData?.purchaseCategoryBreakdown ?? [],
    },
  };
}

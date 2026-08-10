import Decimal from 'decimal.js';
import type { DashboardOperatingLedgerTotals } from './dashboard-overview-model.util';

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
type LedgerProjection = DashboardOperatingLedgerTotals & {
  reportingClassCounts?: Partial<Record<
    'operating_purchase' | 'operating_recurring_expense' | 'operating_other_expense' | 'operating_payroll',
    number
  >>;
};

function percentageOf(value: Decimal, total: Decimal): number | null {
  if (total.isZero()) return null;
  return value.div(total).mul(100).toDecimalPlaces(2).toNumber();
}

export function buildDashboardOperationalOverview(
  periodData: PeriodData,
  kpiCards: readonly KpiCard[],
  ledger?: LedgerProjection,
) {
  const salesCard = kpiCards.find((row) => row.key === 'sales');
  const sales = new Decimal(ledger?.sales ?? salesCard?.value ?? 0).plus(ledger?.taxCollected ?? 0);
  const fixedExpenseKind = periodData?.totalsByKind?.fixed_expense;
  const recurringCosts = ledger
    ? new Decimal(ledger.recurringExpenses ?? 0).plus(ledger.payroll ?? 0)
    : new Decimal(periodData?.fixedExpenseTotal ?? fixedExpenseKind?.totalAmount ?? 0);
  const purchases = ledger ? new Decimal(ledger.purchases ?? 0) : new Decimal(periodData?.purchaseCategoryTotal || 0);
  const otherExpenses = ledger ? new Decimal(ledger.otherExpenses ?? 0) : new Decimal(periodData?.otherExpenseTotal ?? 0);
  const operatingCosts = ledger ? new Decimal(ledger.operatingCosts ?? 0) : purchases.plus(recurringCosts).plus(otherExpenses);

  return {
    sales: sales.toString(),
    recurringCosts: {
      amount: recurringCosts.toString(),
      recordCount: ledger
        ? (ledger.reportingClassCounts?.operating_recurring_expense ?? 0) + (ledger.reportingClassCounts?.operating_payroll ?? 0)
        : periodData?.fixedExpenseInvoiceCount ?? fixedExpenseKind?.invoiceCount ?? 0,
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

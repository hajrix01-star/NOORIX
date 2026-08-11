import Decimal from 'decimal.js';
import type { DashboardOperatingLedgerTotals } from './dashboard-overview-model.util';
import type { DashboardLedgerCategoryBreakdownRow, DashboardLedgerReportingClass } from './dashboard-ledger-projection.util';

type KpiCard = { key: string; value: number };
type LedgerProjection = DashboardOperatingLedgerTotals & {
  categories: {
    purchases: DashboardLedgerCategoryBreakdownRow[];
    recurringExpenses: DashboardLedgerCategoryBreakdownRow[];
    otherExpenses: DashboardLedgerCategoryBreakdownRow[];
    payroll: DashboardLedgerCategoryBreakdownRow[];
  };
  reportingClassRecordCounts: Record<DashboardLedgerReportingClass, number>;
};

function percentageOf(value: Decimal, total: Decimal): number | null {
  if (total.isZero()) return null;
  return value.div(total).mul(100).toDecimalPlaces(2).toNumber();
}

function normalizeCategoryShares(
  rows: readonly DashboardLedgerCategoryBreakdownRow[],
  total: Decimal,
): DashboardLedgerCategoryBreakdownRow[] {
  return [...rows]
    .sort((a, b) => new Decimal(b.amount).comparedTo(a.amount) || a.nameAr.localeCompare(b.nameAr, 'ar'))
    .map((row) => ({
      ...row,
      sharePct: total.isZero() ? null : new Decimal(row.amount).div(total).mul(100).toDecimalPlaces(2).toNumber(),
    }));
}

/**
 * Every monetary amount and category row in the overview comes from classified
 * LedgerEntry rows. Operational counts such as customers remain outside this model.
 */
export function buildDashboardOperationalOverview(
  _legacyPeriodData: unknown,
  _legacyKpiCards: readonly KpiCard[],
  ledger: LedgerProjection,
) {
  if (!ledger) throw new Error('Classified ledger projection is required for dashboard monetary amounts');
  const sales = new Decimal(ledger.sales ?? 0).plus(ledger.taxCollected ?? 0);
  const recurringCosts = new Decimal(ledger.recurringExpenses ?? 0).plus(ledger.payroll ?? 0);
  const purchases = new Decimal(ledger.purchases ?? 0);
  const otherExpenses = new Decimal(ledger.otherExpenses ?? 0);
  const operatingCosts = new Decimal(ledger.operatingCosts ?? 0);
  const recurringCategories = normalizeCategoryShares(
    [...ledger.categories.recurringExpenses, ...ledger.categories.payroll],
    recurringCosts,
  );

  return {
    sales: sales.toString(),
    recurringCosts: {
      amount: recurringCosts.toString(),
      recordCount:
        (ledger.reportingClassRecordCounts.operating_recurring_expense ?? 0)
        + (ledger.reportingClassRecordCounts.operating_payroll ?? 0),
      shareOfSalesPct: percentageOf(recurringCosts, sales),
      categories: recurringCategories,
    },
    otherExpenses: {
      amount: otherExpenses.toString(),
      shareOfSalesPct: percentageOf(otherExpenses, sales),
      categories: normalizeCategoryShares(ledger.categories.otherExpenses, otherExpenses),
    },
    purchases: {
      amount: purchases.toString(),
      shareOfSalesPct: percentageOf(purchases, sales),
      categories: normalizeCategoryShares(ledger.categories.purchases, purchases),
    },
    operatingCosts: {
      amount: operatingCosts.toString(),
      shareOfSalesPct: percentageOf(operatingCosts, sales),
    },
  };
}

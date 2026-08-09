import Decimal from 'decimal.js';
import type { DashboardKpiCardMetric } from './dashboard-overview-model.util';

type OperationalOverview = {
  purchases: { amount: string | number };
  recurringCosts: { amount: string | number };
  otherExpenses: { amount: string | number };
  operatingCosts: { amount: string | number };
};

function valueOf(value: string | number | null | undefined): Decimal {
  return new Decimal(value ?? 0);
}

function percentageOf(value: Decimal, sales: Decimal): number | null {
  return sales.isZero() ? null : value.div(sales).mul(100).toDecimalPlaces(2).toNumber();
}

/**
 * The overview is a management view: its operating-cost card must reconcile
 * exactly to its three visible cost sections. The statutory ledger P&L remains
 * available in Reports and is intentionally not mixed with cash movements.
 */
export function buildDashboardExecutiveKpis(
  baseCards: readonly DashboardKpiCardMetric[],
  overview: OperationalOverview,
): DashboardKpiCardMetric[] {
  const sales = valueOf(baseCards.find((card) => card.key === 'sales')?.value);
  const purchases = valueOf(overview.purchases.amount);
  const recurringCosts = valueOf(overview.recurringCosts.amount);
  const otherExpenses = valueOf(overview.otherExpenses.amount);
  const operatingCosts = valueOf(overview.operatingCosts.amount);
  const grossProfit = sales.minus(purchases);
  const operatingResult = sales.minus(operatingCosts);

  const byKey: Record<string, DashboardKpiCardMetric> = {
    purchases: { key: 'purchases', value: purchases.toNumber(), pct: percentageOf(purchases, sales), tone: 'cost' },
    expenses: {
      key: 'expenses', value: recurringCosts.plus(otherExpenses).toNumber(),
      pct: percentageOf(recurringCosts.plus(otherExpenses), sales), tone: 'cost',
    },
    outflow: { key: 'outflow', value: operatingCosts.toNumber(), pct: percentageOf(operatingCosts, sales), tone: 'cost' },
    grossProfit: { key: 'grossProfit', value: grossProfit.toNumber(), pct: percentageOf(grossProfit, sales), tone: grossProfit.gte(0) ? 'positive' : 'negative' },
    netProfit: { key: 'netProfit', value: operatingResult.toNumber(), pct: percentageOf(operatingResult, sales), tone: operatingResult.gte(0) ? 'positive' : 'negative' },
  };

  return baseCards.map((card) => byKey[card.key] ?? card);
}

/**
 * Client-side validation for financial insight thresholds (percent inputs 0–100).
 * API stores decimals in [0, 1] for ratio bands and net margin bands.
 */

export type InsightThresholdPercentFields = {
  purchaseWarningPct: number;
  purchaseCriticalPct: number;
  expenseWarningPct: number;
  expenseCriticalPct: number;
  netProfitWarningBelowPct: number;
};

export function validateInsightThresholdPercents(f: InsightThresholdPercentFields): string | null {
  const nums = [
    f.purchaseWarningPct,
    f.purchaseCriticalPct,
    f.expenseWarningPct,
    f.expenseCriticalPct,
    f.netProfitWarningBelowPct,
  ];
  for (const n of nums) {
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      return 'range';
    }
  }
  if (!(f.purchaseWarningPct < f.purchaseCriticalPct)) {
    return 'purchaseOrder';
  }
  if (!(f.expenseWarningPct < f.expenseCriticalPct)) {
    return 'expenseOrder';
  }
  return null;
}

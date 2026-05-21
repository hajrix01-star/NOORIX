/** Central numeric thresholds for v1 deterministic insights (no company overrides yet). */

export const INSIGHT_THRESHOLDS = {
  purchaseToSales: {
    warning: 0.65,
    critical: 0.8,
  },
  expenseToSales: {
    warning: 0.35,
    critical: 0.5,
  },
  /** Net profit / sales when sales > 0 */
  netProfitMargin: {
    warningHigh: 0.05,
  },
  /** Treat |sales| below this as near-zero for ratios */
  salesEpsilon: 1e-9,
  /** Current-month purchases vs trailing recent-month average (same P&L year, accounting purchases only) */
  unusuallyHighPurchases: {
    increaseWarning: 0.4,
  },
  /** Current-month gross / net profit vs trailing recent-month average — both directions */
  unusualProfitChange: {
    changeWarning: 0.4,
  },
} as const;

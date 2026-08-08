import type { InsightItem } from '../insights.types';
import type { OverviewPlBreakdownRow } from '../shared/overview-pl-breakdown.util';

export const EXPENSE_INSIGHTS_SCHEMA_VERSION = 1 as const;

export type ExpenseInsightsLabels = {
  expenseBreakdownScope: 'accounting_ledger_pl_month';
  expenseSpikeScope: 'accounting_ledger_pl_expense_totals';
  fixedExpenseScope: 'invoice_period_recurring_expenses_including_recurring_hr';
};

export type ExpenseInsightsPayload = {
  schemaVersion: typeof EXPENSE_INSIGHTS_SCHEMA_VERSION;
  generatedAt: string;
  context: {
    companyId: string;
    year: number;
    selectedMonth: number | null;
    labels: ExpenseInsightsLabels;
  };
  expenseInsights: InsightItem[];
  warnings: InsightItem[];
  /** P&L expense `category:` rows for the selected month (read-only presentation slice). */
  expenseCategoryBreakdown?: OverviewPlBreakdownRow[];
};

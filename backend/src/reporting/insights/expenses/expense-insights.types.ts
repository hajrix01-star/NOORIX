import type { InsightItem } from '../insights.types';

export const EXPENSE_INSIGHTS_SCHEMA_VERSION = 1 as const;

export type ExpenseInsightsLabels = {
  expenseBreakdownScope: 'accounting_ledger_pl_month';
  expenseSpikeScope: 'accounting_ledger_pl_expense_totals';
  fixedExpenseScope: 'accounting_ledger_pl_kind_fixed_expense';
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
};

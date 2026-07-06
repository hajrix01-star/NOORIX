import { Injectable } from '@nestjs/common';
import { ReportingFacade, type DashboardSummaryDateRange, type DashboardSummaryPayload } from '../../reporting.facade';
import {
  ruleFixedExpensePressure,
  ruleMissingExpenseCategory,
  ruleTopExpenseCategoryShare,
  ruleUnusualExpenseSpike,
} from './expense-insights.rules';
import type { ExpenseInsightsPayload } from './expense-insights.types';
import { EXPENSE_INSIGHTS_SCHEMA_VERSION } from './expense-insights.types';
import { buildExpenseCategoryBreakdownForMonth } from '../shared/overview-pl-breakdown.util';

/**
 * Wave 2 — expense deterministic insights from {@link ReportingFacade.getDashboardSummary} only.
 * Not exposed via HTTP; safe to register for tests and future wiring.
 */
@Injectable()
export class ExpenseInsightsService {
  constructor(private readonly reportingFacade: Pick<ReportingFacade, 'getDashboardSummary'>) {}

  async buildExpenseInsights(
    companyId: string,
    dateRange: DashboardSummaryDateRange,
    selectedMonth: number | null,
    preloadedSummary?: DashboardSummaryPayload,
  ): Promise<ExpenseInsightsPayload> {
    const summary =
      preloadedSummary ?? (await this.reportingFacade.getDashboardSummary(companyId, dateRange));
    const { profitLoss } = summary;

    const warnings = [
      ruleTopExpenseCategoryShare(profitLoss, selectedMonth),
      ruleMissingExpenseCategory(profitLoss, selectedMonth),
      ruleUnusualExpenseSpike(profitLoss, selectedMonth),
      ruleFixedExpensePressure(profitLoss, selectedMonth),
    ].filter((w): w is NonNullable<typeof w> => w != null);

    const expenseCategoryBreakdown = buildExpenseCategoryBreakdownForMonth(profitLoss, selectedMonth, 5);

    return {
      schemaVersion: EXPENSE_INSIGHTS_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      context: {
        companyId,
        year: dateRange.year,
        selectedMonth,
        labels: {
          expenseBreakdownScope: 'accounting_ledger_pl_month',
          expenseSpikeScope: 'accounting_ledger_pl_expense_totals',
          fixedExpenseScope: 'accounting_ledger_pl_kind_fixed_expense',
        },
      },
      expenseInsights: [],
      warnings,
      ...(expenseCategoryBreakdown?.length ? { expenseCategoryBreakdown } : {}),
    };
  }
}

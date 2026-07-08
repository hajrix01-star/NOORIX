import { Inject, Injectable } from '@nestjs/common';
import { ReportingFacade, type DashboardSummaryDateRange } from '../reporting.facade';
import { DashboardInsightsService } from './dashboard-insights.service';
import { ExpenseInsightsService } from './expenses/expense-insights.service';
import { PurchaseSupplierInsightsService } from './purchases/purchase-supplier-insights.service';
import type { InsightItem, InsightSeverity } from './insights.types';
import type {
  CombinedInsightWarning,
  ExtendedReportingInsightsPayload,
  InsightWarningSource,
} from './reporting-insights-aggregator.types';
import { EXTENDED_REPORTING_INSIGHTS_SCHEMA_VERSION } from './reporting-insights-aggregator.types';

type TaggedWarning = {
  warning: InsightItem;
  source: InsightWarningSource;
  /** Merge order: dashboard, then purchases, then expenses (stable tie-break). */
  order: number;
};

function severityRank(s: InsightSeverity): number {
  if (s === 'critical') return 0;
  if (s === 'warning') return 1;
  return 2;
}

function dedupeKey(w: InsightItem): string {
  return `${w.id}|${w.metricBasis}|${w.category}`;
}

/**
 * Orchestrates {@link DashboardInsightsService}, {@link PurchaseSupplierInsightsService},
 * and {@link ExpenseInsightsService} into one extended payload. No HTTP exposure; no new calculations.
 * Fetches {@link ReportingFacade.getDashboardSummary} once per request and passes it to all three builders.
 */
@Injectable()
export class ReportingInsightsAggregatorService {
  constructor(
    @Inject(ReportingFacade)
    private readonly reportingFacade: Pick<ReportingFacade, 'getDashboardSummary'>,
    @Inject(DashboardInsightsService)
    private readonly dashboardInsightsService: Pick<DashboardInsightsService, 'buildDashboardInsights'>,
    @Inject(PurchaseSupplierInsightsService)
    private readonly purchaseSupplierInsightsService: Pick<PurchaseSupplierInsightsService, 'buildPurchaseSupplierInsights'>,
    @Inject(ExpenseInsightsService)
    private readonly expenseInsightsService: Pick<ExpenseInsightsService, 'buildExpenseInsights'>,
  ) {}

  /**
   * @param selectedMonth — forwarded to all three builders (P&L / invoice windows); defaults to `null` for annual-style runs.
   */
  async getExtendedInsights(
    companyId: string,
    dateRange: DashboardSummaryDateRange,
    selectedMonth: number | null = null,
    refDate: Date = new Date(),
  ): Promise<ExtendedReportingInsightsPayload> {
    const summary = await this.reportingFacade.getDashboardSummary(companyId, dateRange);
    const [dashboardInsights, purchaseSupplierInsights, expenseInsights] = await Promise.all([
      this.dashboardInsightsService.buildDashboardInsights(
        companyId,
        dateRange,
        selectedMonth,
        refDate,
        summary,
      ),
      this.purchaseSupplierInsightsService.buildPurchaseSupplierInsights(
        companyId,
        dateRange,
        selectedMonth,
        summary,
      ),
      this.expenseInsightsService.buildExpenseInsights(companyId, dateRange, selectedMonth, summary),
    ]);

    const tagged: TaggedWarning[] = [];
    let order = 0;
    const pushAll = (items: InsightItem[], source: InsightWarningSource) => {
      for (const warning of items) {
        tagged.push({ warning, source, order: order++ });
      }
    };
    pushAll(dashboardInsights.warnings, 'dashboard');
    pushAll(purchaseSupplierInsights.warnings, 'purchases');
    pushAll(expenseInsights.warnings, 'expenses');

    const seen = new Set<string>();
    const deduped: TaggedWarning[] = [];
    for (const t of tagged) {
      const k = dedupeKey(t.warning);
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(t);
    }

    deduped.sort((a, b) => {
      const dr = severityRank(a.warning.severity) - severityRank(b.warning.severity);
      if (dr !== 0) return dr;
      return a.order - b.order;
    });

    const warnings: CombinedInsightWarning[] = deduped.map(({ warning, source }) => ({
      ...warning,
      source,
    }));

    return {
      schemaVersion: EXTENDED_REPORTING_INSIGHTS_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      context: {
        companyId,
        year: dateRange.year,
        selectedMonth,
        periodStart: dateRange.periodStart,
        periodEnd: dateRange.periodEnd,
        labels: {
          dashboard: 'dashboard_insights_v1',
          purchases: 'purchase_supplier_insights_v1',
          expenses: 'expense_insights_v1',
        },
      },
      dashboardInsights,
      purchaseSupplierInsights,
      expenseInsights,
      warnings,
    };
  }
}

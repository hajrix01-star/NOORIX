import { Injectable } from '@nestjs/common';
import { ReportingFacade, type DashboardSummaryDateRange } from '../reporting.facade';
import { INSIGHTS_SCHEMA_VERSION } from './insights.types';
import type { DashboardInsightsPayload, InsightItem } from './insights.types';
import {
  computeHealthBand,
  computeHealthScore,
  computeRatios,
  extractAccountingSnapshot,
  rollupOperationalMonth,
  ruleExpenseRatioToSales,
  ruleNegativeProfit,
  ruleNetProfitMargin,
  rulePurchaseRatioToSales,
} from './insights.rules';

/**
 * Phase A — deterministic insights from {@link ReportingFacade.getDashboardSummary} only.
 * Exposed read-only via {@link ../reporting.controller#getDashboardInsights}.
 * Does not change source financial numbers beyond copying into `metrics`.
 */
@Injectable()
export class DashboardInsightsService {
  constructor(private readonly reportingFacade: ReportingFacade) {}

  async buildDashboardInsights(
    companyId: string,
    dateRange: DashboardSummaryDateRange,
    selectedMonth: number | null,
    refDate: Date = new Date(),
  ): Promise<DashboardInsightsPayload> {
    const summary = await this.reportingFacade.getDashboardSummary(companyId, dateRange);
    const { profitLoss, salesPack } = summary;

    const snap = extractAccountingSnapshot(profitLoss, selectedMonth);
    const ratioNotes: string[] = [];
    const { purchaseToSales, expenseToSales, netProfitMargin } = computeRatios(snap, ratioNotes);

    const op = rollupOperationalMonth(salesPack, dateRange.year, selectedMonth);

    const warnings: InsightItem[] = [];

    const push = (item: InsightItem | null) => {
      if (item) warnings.push(item);
    };

    push(rulePurchaseRatioToSales(purchaseToSales));
    push(ruleExpenseRatioToSales(expenseToSales));
    push(ruleNetProfitMargin(netProfitMargin, snap?.numeric.sales ?? null));
    push(ruleNegativeProfit(snap?.numeric.netProfit ?? null));
    // v1 does not emit ruleMissingSalesData — current product relies on accounting P&L revenue, not operational daily summaries.

    const band = computeHealthBand(warnings);
    const score = computeHealthScore(warnings);

    const { summaryAr, summaryEn } = summarizeHealth(band);

    const rawAccounting = snap?.raw ?? {
      sales: null,
      purchases: null,
      expenses: null,
      grossProfit: null,
      netProfit: null,
    };

    return {
      schemaVersion: INSIGHTS_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      context: {
        companyId,
        year: dateRange.year,
        selectedMonth,
        labels: {
          profitLossScope: 'accounting_ledger_pl',
          salesPackScope: 'operational_daily_sales_summaries',
          periodAnalyticsScope: 'invoice_aggregates_period',
        },
      },
      metrics: {
        accounting: {
          sales: rawAccounting.sales,
          purchases: rawAccounting.purchases,
          expenses: rawAccounting.expenses,
          grossProfit: rawAccounting.grossProfit,
          netProfit: rawAccounting.netProfit,
        },
        operational: {
          periodSalesFromSummaries: op.periodSalesFromSummaries,
          activeSalesDaysInMonth: op.activeSalesDaysInMonth,
        },
      },
      ratios: {
        purchaseToSales,
        expenseToSales,
        netProfitMargin,
        notes: ratioNotes,
      },
      health: {
        score,
        band,
        summaryAr,
        summaryEn,
      },
      insights: [],
      opportunities: [],
      warnings,
    };
  }
}

function summarizeHealth(band: DashboardInsightsPayload['health']['band']): {
  summaryAr: string;
  summaryEn: string;
} {
  switch (band) {
    case 'green':
      return {
        summaryAr: 'لا توجد تنبيهات ضمن قواعد الإصدار الأول.',
        summaryEn: 'No alerts under v1 insight rules.',
      };
    case 'amber':
      return {
        summaryAr: 'يوجد تحذيرات تستحق المراجعة.',
        summaryEn: 'There are warnings to review.',
      };
    case 'red':
      return {
        summaryAr: 'يوجد تنبيهات حرجة تستحق المراجعة.',
        summaryEn: 'There are critical alerts to review.',
      };
    default:
      return {
        summaryAr: 'تعذر تصنيف الحالة.',
        summaryEn: 'Health band unknown.',
      };
  }
}

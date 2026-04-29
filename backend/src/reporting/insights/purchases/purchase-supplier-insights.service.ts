import { Injectable } from '@nestjs/common';
import { ReportingFacade, type DashboardSummaryDateRange } from '../../reporting.facade';
import {
  ruleMissingSupplierBreakdown,
  rulePurchaseCategoryConcentration,
  rulePurchaseCategorySpike,
  rulePurchaseUncategorizedShare,
  type PurchaseCategoryBreakdownRow,
  type SupplierCategoryBreakdownRow,
} from './purchase-supplier-insights.rules';
import type { PurchaseSupplierInsightsPayload } from './purchase-supplier-insights.types';
import { PURCHASE_SUPPLIER_INSIGHTS_SCHEMA_VERSION } from './purchase-supplier-insights.types';

/**
 * Wave 2 — purchase/supplier deterministic insights from {@link ReportingFacade.getDashboardSummary} only.
 * Not exposed via HTTP; safe to register for tests and future wiring.
 */
@Injectable()
export class PurchaseSupplierInsightsService {
  constructor(private readonly reportingFacade: ReportingFacade) {}

  async buildPurchaseSupplierInsights(
    companyId: string,
    dateRange: DashboardSummaryDateRange,
    selectedMonth: number | null,
  ): Promise<PurchaseSupplierInsightsPayload> {
    const summary = await this.reportingFacade.getDashboardSummary(companyId, dateRange);
    const pa = summary.periodAnalytics as
      | {
          purchaseCategoryBreakdown?: PurchaseCategoryBreakdownRow[];
          purchaseCategoryTotal?: string;
          supplierCategoryBreakdown?: SupplierCategoryBreakdownRow[];
          suppliersInPeriodCount?: number;
        }
      | null
      | undefined;

    const breakdown = pa?.purchaseCategoryBreakdown;
    const purchaseCategoryTotal = pa?.purchaseCategoryTotal;
    const supplierCategoryBreakdown = pa?.supplierCategoryBreakdown;
    const suppliersInPeriodCount = pa?.suppliersInPeriodCount;

    const warnings = [
      rulePurchaseCategoryConcentration(breakdown, purchaseCategoryTotal),
      rulePurchaseUncategorizedShare(breakdown, purchaseCategoryTotal),
      ruleMissingSupplierBreakdown(supplierCategoryBreakdown, suppliersInPeriodCount),
      rulePurchaseCategorySpike(summary.profitLoss, selectedMonth),
    ].filter((w): w is NonNullable<typeof w> => w != null);

    return {
      schemaVersion: PURCHASE_SUPPLIER_INSIGHTS_SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      context: {
        companyId,
        year: dateRange.year,
        selectedMonth,
        periodStart: dateRange.periodStart,
        periodEnd: dateRange.periodEnd,
        labels: {
          purchaseCategoriesScope: 'invoice_period_purchase_only',
          supplierClassificationScope: 'invoice_period_supplier_counts',
          purchaseCategorySpikeScope: 'accounting_ledger_pl_purchase_categories',
        },
      },
      supplierInsights: [],
      purchaseInsights: [],
      warnings,
      ...(breakdown?.length
        ? { periodPurchaseCategoryBreakdown: breakdown, periodPurchaseCategoryTotal: purchaseCategoryTotal }
        : {}),
    };
  }
}

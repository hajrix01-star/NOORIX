import { Injectable } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';
import { SalesService } from '../sales/sales.service';

type ReportingFacadeReportsReader = Pick<
  ReportsService,
  'getGeneralProfitLoss' | 'getTaxVatReport' | 'getPeriodAnalytics'
>;
type ReportingFacadeSalesReader = Pick<SalesService, 'findDashboardPack'>;

/**
 * Phase 1 reporting facade — delegates only; no calculations or transformations.
 * Callers supply date ranges that match existing dashboard/report contracts.
 */
export type DashboardSummaryDateRange = {
  /** Calendar year for P&L (same as existing general P&L report). */
  year: number;
  yearStart: string;
  yearEnd: string;
  dailyStart?: string | null;
  dailyEnd?: string | null;
  monthStart?: string | null;
  monthEnd?: string | null;
  /** Inclusive bounds for period analytics (YYYY-MM-DD), same as `GET /reports/period-analytics`. */
  periodStart: string;
  periodEnd: string;
  includeCancelledSales?: boolean;
};

@Injectable()
export class ReportingFacade {
  constructor(
    private readonly reportsService: ReportingFacadeReportsReader,
    private readonly salesService: ReportingFacadeSalesReader,
  ) {}

  /** Wraps `ReportsService.getGeneralProfitLoss` — returns the same promise/value. */
  getProfitLossReport(companyId: string, year: number) {
    return this.reportsService.getGeneralProfitLoss(companyId, year);
  }

  /**
   * Wraps `ReportsService.getTaxVatReport` (→ `ReportsTaxVatService`).
   * `year` is required by the underlying VAT report API (period is e.g. Q1, M1).
   */
  getVatReport(
    companyId: string,
    year: number,
    period: string,
    salesAmountIncludesVat = false,
  ) {
    return this.reportsService.getTaxVatReport(companyId, year, period, salesAmountIncludesVat);
  }

  /**
   * Composes existing reads only — same payloads as calling each service separately.
   */
  async getDashboardSummary(companyId: string, dateRange: DashboardSummaryDateRange) {
    const {
      year,
      yearStart,
      yearEnd,
      dailyStart,
      dailyEnd,
      monthStart,
      monthEnd,
      periodStart,
      periodEnd,
      includeCancelledSales = false,
    } = dateRange;

    const [profitLoss, salesPack, periodAnalytics] = await Promise.all([
      this.reportsService.getGeneralProfitLoss(companyId, year),
      this.salesService.findDashboardPack(
        companyId,
        {
          yearStart,
          yearEnd,
          dailyStart,
          dailyEnd,
          monthStart,
          monthEnd,
        },
        includeCancelledSales,
      ),
      this.reportsService.getPeriodAnalytics(companyId, periodStart, periodEnd),
    ]);

    return {
      profitLoss,
      salesPack,
      periodAnalytics,
    };
  }
}

/** Result of {@link ReportingFacade.getDashboardSummary} — pass into insight builders to avoid duplicate reads in one request. */
export type DashboardSummaryPayload = Awaited<ReturnType<ReportingFacade['getDashboardSummary']>>;

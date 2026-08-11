import { Injectable } from '@nestjs/common';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { hasPermission, PERMISSIONS } from '../auth/constants/permissions';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ReportsService } from '../reports/reports.service';
import { SalesService } from '../sales/sales.service';
import { DashboardInsightsService } from '../reporting/insights/dashboard-insights.service';
import { VaultsService } from '../vaults/vaults.service';
import type { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import {
  EMPTY_SALES_PACK,
  buildDashboardOverviewRanges,
  buildDashboardLedgerTimelineDailyRows,
  buildDashboardLedgerTimelineMonthlyRows,
  buildDashboardLedgerSalesAverage,
  buildLedgerKpiCards,
  percentChangeNullable,
} from './dashboard-overview-model.util';
import { buildDashboardVaultActivity } from './dashboard-vault-activity.util';
import { buildDashboardOperationalOverview } from './dashboard-operational-overview.util';
import { buildDashboardExecutiveKpis } from './dashboard-executive-kpis.util';
import { DashboardLedgerProjectionService } from './dashboard-ledger-projection.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly reportsService: ReportsService,
    private readonly salesService: SalesService,
    private readonly dashboardInsightsService: DashboardInsightsService,
    private readonly vaultsService: VaultsService,
    private readonly dashboardLedgerProjectionService: DashboardLedgerProjectionService,
  ) {}

  async getOverview(query: DashboardOverviewQueryDto, user: JwtUser) {
    const {
      companyId,
      year,
      yearStart,
      yearEnd,
      periodStart,
      periodEnd,
      dailyStart,
      dailyEnd,
      monthStart,
      monthEnd,
      weeklyYearStart,
      weeklyYearEnd,
      weeklyStart,
      weeklyEnd,
      weeklyBaselineStart,
      weeklyBaselineEnd,
      previousMonthYearStart,
      previousMonthYearEnd,
      previousMonthStart,
      previousMonthEnd,
      selectedMonth,
      includeCancelledSales = false,
    } = query;

    const hasSalesRead = hasPermission(
      user.role,
      PERMISSIONS.SALES_VIEW_SUMMARIES_LIST,
      user.permissions,
    );
    const fullHist = hasPermission(user.role, PERMISSIONS.SALES_FULL_HISTORY, user.permissions);

    const { ys, ye, ds, de, ms, me, wys, wye, ws, we, wbs, wbe, pmys, pmye, pms, pme } =
      buildDashboardOverviewRanges(
        {
          yearStart,
          yearEnd,
          dailyStart,
          dailyEnd,
          monthStart,
          monthEnd,
          weeklyYearStart,
          weeklyYearEnd,
          weeklyStart,
          weeklyEnd,
          weeklyBaselineStart,
          weeklyBaselineEnd,
          previousMonthYearStart,
          previousMonthYearEnd,
          previousMonthStart,
          previousMonthEnd,
        },
        fullHist,
      );

    const salesPackPromise = hasSalesRead
      ? this.salesService.findDashboardPack(
          companyId,
          { yearStart: ys, yearEnd: ye, dailyStart: ds, dailyEnd: de, monthStart: ms, monthEnd: me },
          includeCancelledSales,
        )
      : Promise.resolve(EMPTY_SALES_PACK);
    const weeklyPackPromise = hasSalesRead && ws && we
      ? this.salesService.findDashboardPack(
          companyId,
          {
            yearStart: wys,
            yearEnd: wye,
            dailyStart: ws,
            dailyEnd: we,
            monthStart: null,
            monthEnd: null,
            baselineStart: wbs,
            baselineEnd: wbe,
          },
          includeCancelledSales,
        )
      : Promise.resolve(EMPTY_SALES_PACK);
    const previousMonthPackPromise = hasSalesRead && pms && pme
      ? this.salesService.findDashboardPack(
          companyId,
          {
            yearStart: pmys,
            yearEnd: pmye,
            dailyStart: null,
            dailyEnd: null,
            monthStart: pms,
            monthEnd: pme,
          },
          includeCancelledSales,
        )
      : Promise.resolve(EMPTY_SALES_PACK);

    const previousMonthLedgerPromise = pms && pme
      ? this.dashboardLedgerProjectionService.getPeriodProjection(companyId, pms, pme)
      : Promise.resolve(null);

    const [report, salesPack, weeklyPack, previousMonthPack, insights, periodData, vaultPeriodRows, ledgerReconciliation, previousMonthLedger] = await Promise.all([
      this.reportsService.getGeneralProfitLoss(companyId, year),
      salesPackPromise,
      weeklyPackPromise,
      previousMonthPackPromise,
      this.dashboardInsightsService.buildDashboardInsights(
        companyId,
        {
          year,
          yearStart,
          yearEnd,
          dailyStart: dailyStart ?? null,
          dailyEnd: dailyEnd ?? null,
          monthStart: monthStart ?? null,
          monthEnd: monthEnd ?? null,
          periodStart,
          periodEnd,
          includeCancelledSales,
        },
        selectedMonth ?? null,
      ),
      this.reportsService.getPeriodAnalytics(companyId, periodStart, periodEnd),
      this.vaultsService.findAll(companyId, true, periodStart, periodEnd),
      this.dashboardLedgerProjectionService.getPeriodReconciliation(companyId, periodStart, periodEnd),
      previousMonthLedgerPromise,
    ]);

    const salesMetrics = salesPack.metrics;
    // Monetary dashboard figures are ledger-first. Reconciliation remains visible
    // as a quality signal, but it never sends the UI back to invoice aggregates.
    const ledgerProjection = ledgerReconciliation.ledger;
    const ledgerIsReady = ledgerReconciliation.readyForCutover;
    const operatingLedgerProjection = ledgerProjection;
    const currentSalesAverage = buildDashboardLedgerSalesAverage(ledgerProjection, salesMetrics?.monthAverage);
    const previousSalesAverage = previousMonthLedger?.coverage.unclassifiedRowCount === 0
      ? buildDashboardLedgerSalesAverage(previousMonthLedger, previousMonthPack.metrics?.monthAverage)
      : null;
    const presentation = {
      kpiCards: buildLedgerKpiCards(operatingLedgerProjection),
      timeline: {
        monthly: buildDashboardLedgerTimelineMonthlyRows(ledgerProjection.timeline.monthly, year, salesMetrics?.yearDaily ?? []),
        daily: buildDashboardLedgerTimelineDailyRows(ledgerProjection.timeline.daily, salesMetrics?.dailyDaily ?? [], ds, de),
      },
      weeklyComparison: weeklyPack.metrics?.dailyWeeklyComparison ?? [],
      previousMonthAverage: previousSalesAverage,
      salesAverage: { current: currentSalesAverage, previous: previousSalesAverage },
      basketAvgDeltaPct: percentChangeNullable(
        currentSalesAverage?.basketAvg,
        previousSalesAverage?.basketAvg,
      ),
    };

    const operationalOverview = buildDashboardOperationalOverview(
      periodData,
      presentation.kpiCards,
      operatingLedgerProjection,
    );
    presentation.kpiCards = buildDashboardExecutiveKpis(presentation.kpiCards, operationalOverview);

    return {
      report,
      salesPack,
      insights,
      periodData,
      vaultActivity: buildDashboardVaultActivity(vaultPeriodRows),
      ledgerReporting: {
        source: ledgerProjection.source,
        readyForCutover: ledgerIsReady,
        coverage: ledgerProjection.coverage,
        dimensions: ledgerReconciliation.dimensions,
      },
      operationalOverview,
      presentation,
    };
  }

  // ── Calendar Data ─────────────────────────────────────

  /**
   * يحدد ما إذا كان صف أهداف الشهر يحتوي على تخصيص فعلي
   * (الهدف الإجمالي أو هدف يوم من الأسبوع غير فارغ)
   */
  /**
   * يجلب بيانات التقويم لشهر محدد مع fallback للهدف الافتراضي (month=0):
   * - targets: month=X إن وجد تخصيص، وإلا month=0 (الافتراضي لكل الشهور)
   * - specialDays/dayNotes: دائماً خاصة بالشهر فقط
   */

}

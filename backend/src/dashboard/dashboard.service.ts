import { Injectable } from '@nestjs/common';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { hasPermission, PERMISSIONS } from '../auth/constants/permissions';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ReportsService } from '../reports/reports.service';
import { SalesService } from '../sales/sales.service';
import { DashboardInsightsService } from '../reporting/insights/dashboard-insights.service';
import type { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import {
  EMPTY_SALES_PACK,
  buildDashboardOverviewRanges,
  buildDashboardTimelineDailyRows,
  buildDashboardTimelineMonthlyRows,
  buildKpiCards,
  percentChangeNullable,
  type DashboardDailyMetricRow,
  type DashboardProfitLossReport,
} from './dashboard-overview-model.util';

      avgInvoice: current.customers > 0 ? current.sales / current.customers : 0,
    };
  });
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly reportsService: ReportsService,
    private readonly salesService: SalesService,
    private readonly dashboardInsightsService: DashboardInsightsService,
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

    const [report, salesPack, weeklyPack, previousMonthPack, insights, periodData] = await Promise.all([
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
    ]);

    const reportLike = report as DashboardProfitLossReport | null;
    const salesMetrics = salesPack.metrics;
    const presentation = {
      kpiCards: buildKpiCards({
        report: reportLike,
        periodData,
        dailyRows: salesMetrics?.dailyDaily ?? [],
        selectedMonth: selectedMonth ?? null,
        isCustomRange: selectedMonth == null && (periodStart !== yearStart || periodEnd !== yearEnd),
      }),
      timeline: {
        monthly: buildDashboardTimelineMonthlyRows(reportLike, salesMetrics?.yearDaily ?? []),
        daily: buildDashboardTimelineDailyRows(salesMetrics?.dailyDaily ?? [], ds, de),
      },
      weeklyComparison: weeklyPack.metrics?.dailyWeeklyComparison ?? [],
      previousMonthAverage: previousMonthPack.metrics?.monthAverage ?? null,
      basketAvgDeltaPct: percentChangeNullable(
        salesMetrics?.monthAverage?.basketAvg,
        previousMonthPack.metrics?.monthAverage?.basketAvg,
      ),
    };

    return { report, salesPack, insights, periodData, presentation };
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

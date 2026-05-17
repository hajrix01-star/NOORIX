import { Injectable } from '@nestjs/common';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { hasPermission, PERMISSIONS } from '../auth/constants/permissions';
import { clampSalesSummaryDateQuery } from '../common/utils/sales-summary-date-range';
import { toYmd } from '../common/utils/to-ymd.util';
import { ReportsService } from '../reports/reports.service';
import { SalesService } from '../sales/sales.service';
import { DashboardInsightsService } from '../reporting/insights/dashboard-insights.service';
import type { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';

const EMPTY_SALES_PACK = { yearSummaries: [], dailySummaries: [], monthSummaries: [] } as const;

@Injectable()
export class DashboardService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly salesService: SalesService,
    private readonly dashboardInsightsService: DashboardInsightsService,
  ) {}

  /**
   * يجمع 4 استعلامات منفصلة في طلب واحد بالتوازي:
   *   1. P&L (general profit-loss report)
   *   2. Sales pack (year + daily + month summaries)
   *   3. Dashboard insights
   *   4. Period analytics
   *
   * يُعيد كائناً موحّداً — الواجهة لا تعرض أي رقم حتى تكتمل جميع الأجزاء.
   */
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
      selectedMonth,
      includeCancelledSales = false,
    } = query;

    const hasSalesRead = hasPermission(
      user.role,
      PERMISSIONS.SALES_VIEW_SUMMARIES_LIST,
      user.permissions,
    );
    const fullHist = hasPermission(user.role, PERMISSIONS.SALES_FULL_HISTORY, user.permissions);

    let ys = toYmd(yearStart);
    let ye = toYmd(yearEnd);
    let ds = dailyStart ? toYmd(dailyStart) : null;
    let de = dailyEnd ? toYmd(dailyEnd) : null;
    let ms = monthStart ? toYmd(monthStart) : null;
    let me = monthEnd ? toYmd(monthEnd) : null;

    if (!fullHist) {
      const cy = clampSalesSummaryDateQuery(ys, ye, 7);
      ys = cy.startDate;
      ye = cy.endDate;
      if (ds && de) {
        const cd = clampSalesSummaryDateQuery(ds, de, 7);
        ds = cd.startDate;
        de = cd.endDate;
      }
      if (ms && me) {
        const cm = clampSalesSummaryDateQuery(ms, me, 7);
        ms = cm.startDate;
        me = cm.endDate;
      }
    }

    const salesPackPromise = hasSalesRead
      ? this.salesService.findDashboardPack(
          companyId,
          { yearStart: ys, yearEnd: ye, dailyStart: ds, dailyEnd: de, monthStart: ms, monthEnd: me },
          includeCancelledSales,
        )
      : Promise.resolve(EMPTY_SALES_PACK);

    const [report, salesPack, insights, periodData] = await Promise.all([
      this.reportsService.getGeneralProfitLoss(companyId, year),
      salesPackPromise,
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

    return { report, salesPack, insights, periodData };
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { toYmd } from '../common/utils/to-ymd.util';
import {
  appSalesModel,
  channelBreakdown,
  dailyTotalRows,
  monthlyDailyAverages,
  periodDailyAverage,
  salesShiftTotals,
  selectedMonthAverageEndDay,
  weekdayAverageRows,
  weeklyComparisonRows,
  weeklyRows,
  type DashboardChannelMetricRow,
} from './sales-dashboard-metrics.util';
import { dailySalesSummaryListInclude, salesSummaryDateWhere } from './sales-summary-query.util';

type DashboardPackRanges = {
  yearStart: string;
  yearEnd: string;
  dailyStart?: string | null;
  dailyEnd?: string | null;
  monthStart?: string | null;
  monthEnd?: string | null;
  baselineStart?: string | null;
  baselineEnd?: string | null;
};

@Injectable()
export class SalesDashboardPackService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async findDashboardPack(companyId: string, ranges: DashboardPackRanges, includeCancelled = false) {
    const statusFilter: Prisma.DailySalesSummaryWhereInput = includeCancelled
      ? { status: { in: ['active', 'cancelled'] } }
      : { status: 'active' };
    const orderBy: Prisma.DailySalesSummaryOrderByWithRelationInput[] = [
      { transactionDate: 'asc' },
      { summaryNumber: 'asc' },
    ];

    const y0 = toYmd(ranges.yearStart);
    const y1 = toYmd(ranges.yearEnd);
    const yearWhere = salesSummaryDateWhere(companyId, y0, y1, includeCancelled);
    const dailyWhere = this.optionalRangeWhere(companyId, ranges.dailyStart, ranges.dailyEnd, statusFilter);
    const monthWhere = this.optionalRangeWhere(companyId, ranges.monthStart, ranges.monthEnd, statusFilter);
    const include = dailySalesSummaryListInclude();

    const [
      yearSummaries,
      dailySummaries,
      monthSummaries,
      yearDailyMetrics,
      yearChannelMetrics,
      dailyDailyMetrics,
      dailyChannelMetrics,
      monthDailyMetrics,
      baselineDailyMetrics,
    ] = await Promise.all([
      this.prisma.dailySalesSummary.findMany({ where: yearWhere, orderBy, take: 4000, include }),
      dailyWhere ? this.prisma.dailySalesSummary.findMany({ where: dailyWhere, orderBy, take: 500, include }) : [],
      monthWhere ? this.prisma.dailySalesSummary.findMany({ where: monthWhere, orderBy, take: 500, include }) : [],
      this.buildDashboardDailyMetricRows(companyId, y0, y1, includeCancelled),
      this.buildDashboardChannelMetricRows(companyId, y0, y1, includeCancelled),
      ranges.dailyStart && ranges.dailyEnd
        ? this.buildDashboardDailyMetricRows(companyId, ranges.dailyStart, ranges.dailyEnd, includeCancelled)
        : [],
      ranges.dailyStart && ranges.dailyEnd
        ? this.buildDashboardChannelMetricRows(companyId, ranges.dailyStart, ranges.dailyEnd, includeCancelled)
        : [],
      ranges.monthStart && ranges.monthEnd
        ? this.buildDashboardDailyMetricRows(companyId, ranges.monthStart, ranges.monthEnd, includeCancelled)
        : [],
      ranges.baselineStart && ranges.baselineEnd
        ? this.buildDashboardDailyMetricRows(companyId, ranges.baselineStart, ranges.baselineEnd, includeCancelled)
        : [],
    ]);

    const monthAverageEndDay = selectedMonthAverageEndDay(monthDailyMetrics);
    const monthAverage = periodDailyAverage(monthDailyMetrics, monthAverageEndDay);

    return {
      yearSummaries,
      dailySummaries,
      monthSummaries,
      metrics: {
        yearDaily: yearDailyMetrics,
        yearChannels: yearChannelMetrics,
        dailyDaily: dailyDailyMetrics,
        dailyTotals: dailyTotalRows(dailyDailyMetrics),
        dailyChannels: dailyChannelMetrics,
        channelBreakdown: channelBreakdown(dailyChannelMetrics),
        monthDaily: monthDailyMetrics,
        monthAverage,
        weekdayAverages: weekdayAverageRows(monthDailyMetrics, monthAverage.calendarDays),
        dailyWeekly: weeklyRows(dailyDailyMetrics),
        dailyWeeklyComparison: weeklyComparisonRows(dailyDailyMetrics, baselineDailyMetrics),
        shiftTotals: salesShiftTotals(dailyDailyMetrics),
        yearMonthlyDailyAverages: monthlyDailyAverages(yearDailyMetrics),
        appSales: appSalesModel(y0, y1, yearDailyMetrics, yearChannelMetrics),
      },
    };
  }

  private optionalRangeWhere(
    companyId: string,
    startDate: string | null | undefined,
    endDate: string | null | undefined,
    statusFilter: Prisma.DailySalesSummaryWhereInput,
  ): Prisma.DailySalesSummaryWhereInput | null {
    if (!startDate || !endDate) return null;
    return {
      companyId,
      ...statusFilter,
      transactionDate: {
        gte: new Date(`${toYmd(startDate)}T00:00:00.000Z`),
        lte: new Date(`${toYmd(endDate)}T23:59:59.999Z`),
      },
    };
  }

  private async buildDashboardDailyMetricRows(
    companyId: string,
    startDate: string,
    endDate: string,
    includeCancelled: boolean,
  ) {
    const rows = await this.prisma.dailySalesSummary.groupBy({
      by: ['transactionDate', 'shift'],
      where: salesSummaryDateWhere(companyId, startDate, endDate, includeCancelled),
      _sum: { totalAmount: true, customerCount: true },
      orderBy: [{ transactionDate: 'asc' }, { shift: 'asc' }],
    });

    return rows.map((row) => ({
      transactionDate: toYmd(row.transactionDate),
      shift: row.shift,
      totalAmount: row._sum.totalAmount?.toString() ?? '0',
      customerCount: row._sum.customerCount ?? 0,
    }));
  }

  private async buildDashboardChannelMetricRows(
    companyId: string,
    startDate: string,
    endDate: string,
    includeCancelled: boolean,
  ) {
    const statusSql = includeCancelled
      ? Prisma.sql`s.status IN ('active', 'cancelled')`
      : Prisma.sql`s.status = 'active'`;

    return this.prisma.$queryRaw<DashboardChannelMetricRow[]>(Prisma.sql`
      SELECT
        to_char(date_trunc('month', s.transaction_date), 'YYYY-MM') AS "periodKey",
        v.id AS "vaultId",
        v.name_ar AS "nameAr",
        v.name_en AS "nameEn",
        v.type AS "type",
        SUM(c.amount)::text AS "amount"
      FROM daily_sales_channels c
      INNER JOIN daily_sales_summaries s ON s.id = c.summary_id
      INNER JOIN vaults v ON v.id = c.vault_id
      WHERE
        s.company_id = ${companyId}
        AND ${statusSql}
        AND s.transaction_date >= ${new Date(`${toYmd(startDate)}T00:00:00.000Z`)}
        AND s.transaction_date <= ${new Date(`${toYmd(endDate)}T23:59:59.999Z`)}
      GROUP BY "periodKey", v.id, v.name_ar, v.name_en, v.type
      ORDER BY "periodKey" ASC, SUM(c.amount) DESC
    `);
  }
}

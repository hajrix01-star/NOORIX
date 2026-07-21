import { Injectable } from '@nestjs/common';
import { JwtUser } from '../auth/decorators/current-user.decorator';
import { hasPermission, PERMISSIONS } from '../auth/constants/permissions';
import { clampSalesSummaryDateQuery } from '../common/utils/sales-summary-date-range';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ReportsService } from '../reports/reports.service';
import { SalesService } from '../sales/sales.service';
import { DashboardInsightsService } from '../reporting/insights/dashboard-insights.service';
import type { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import { getSaudiOccasionsForYear } from './saudi-occasions.data';
import { shiftGregorianYmd } from './saudi-occasions.umalqura';
import {
  mergeSpecialDayPeriods,
  occasionsToSpecialDayPeriods,
  type SpecialDayPeriod,
} from './dashboard-special-days.util';
import {
  DEFAULT_DASHBOARD_CALENDAR_DATA,
  calendarTargetsJson,
  dayNotesJson,
  hasCalendarTargetOverride,
  normalizeCalendarDayNotes,
  normalizeCalendarSpecialDays,
  normalizeCalendarTargets,
  specialDaysJson,
} from './dashboard-calendar-contracts';
import { isSuperAdmin } from '../auth/constants/permissions';

const EMPTY_SALES_PACK = {
  yearSummaries: [],
  dailySummaries: [],
  monthSummaries: [],
  metrics: {
    yearDaily: [],
    yearChannels: [],
    dailyDaily: [],
    dailyTotals: [],
    dailyChannels: [],
    channelBreakdown: [],
    monthDaily: [],
    monthAverage: null,
    dailyWeekly: [],
    dailyWeeklyComparison: [],
    shiftTotals: [],
    yearMonthlyDailyAverages: [],
    appSales: {
      year: null,
      totals: [],
      monthlyRows: [],
      yearAverage: null,
      selectedMonthAverage: null,
      selectedMonthAppShare: null,
      previousMonthAverage: null,
      selectedMonth: null,
    },
  },
} as const;

type DashboardDailyMetricRow = {
  transactionDate: string;
  totalAmount: string | number;
  customerCount: number;
};

type DashboardProfitLossGroup = {
  key?: string;
  months?: Array<string | number | null | undefined>;
};

type DashboardProfitLossReport = {
  cards?: Record<string, string | number | null | undefined>;
  summaryRows?: DashboardProfitLossGroup[];
  groups?: DashboardProfitLossGroup[];
};

type DashboardTimelineRow = {
  label: string;
  sales: number;
  purchases: number;
  expenses: number;
  customers: number;
  avgInvoice: number;
};

type DashboardKpiCardMetric = {
  key: string;
  value: number;
  pct: number | null;
  tone: 'positive' | 'negative' | 'neutral' | 'cost';
};

type DashboardPeriodData = {
  totalsByKind?: Record<string, { totalAmount?: string | number | null }>;
} | null;

function monthNumberFromYmd(value: string): number | null {
  const ymd = toYmd(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const month = Number(ymd.slice(5, 7));
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : null;
}

function dayNumberFromYmd(value: string): number | null {
  const ymd = toYmd(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const day = Number(ymd.slice(8, 10));
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

function inclusiveDayRange(startDate: string | null, endDate: string | null): number[] {
  if (!startDate || !endDate) return [];
  const start = toYmd(startDate);
  const end = toYmd(endDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return [];
  if (start.slice(0, 7) !== end.slice(0, 7)) return [];
  const startDay = dayNumberFromYmd(start);
  const endDay = dayNumberFromYmd(end);
  if (startDay == null || endDay == null || endDay < startDay) return [];
  return Array.from({ length: endDay - startDay + 1 }, (_, index) => startDay + index);
}

function reportMonthValue(
  report: DashboardProfitLossReport | null,
  key: string,
  monthIndex: number,
): number {
  return Number(report?.groups?.find((row) => row.key === key)?.months?.[monthIndex] || 0);
}

function reportCardValue(
  report: DashboardProfitLossReport | null,
  key: string,
  selectedMonth: number | null,
): number {
  if (!report) return 0;
  if (selectedMonth == null) return Number(report.cards?.[key] || 0);
  if (key === 'grossProfit' || key === 'netProfit') {
    return Number(report.summaryRows?.find((row) => row.key === key)?.months?.[selectedMonth - 1] || 0);
  }
  return Number(report.groups?.find((row) => row.key === key)?.months?.[selectedMonth - 1] || 0);
}

function periodKindTotal(
  periodData: DashboardPeriodData,
  kinds: readonly string[],
): number {
  return kinds.reduce((sum, kind) => sum + Number(periodData?.totalsByKind?.[kind]?.totalAmount || 0), 0);
}

function sumDailyMetric(rows: readonly DashboardDailyMetricRow[], metric: 'totalAmount' | 'customerCount'): number {
  return rows.reduce((sum, row) => sum + Number(row[metric] || 0), 0);
}

function pctOfSales(key: string, value: number, sales: number): number | null {
  if (!Number.isFinite(sales) || Math.abs(sales) <= 1e-9) return null;
  if (key === 'sales') return sales > 0 ? 100 : null;
  return (value / sales) * 100;
}

function kpiTone(key: string, pct: number | null): DashboardKpiCardMetric['tone'] {
  if (pct == null || key === 'sales') return 'neutral';
  if (key === 'purchases' || key === 'expenses') return 'cost';
  if (pct > 0) return 'positive';
  if (pct < 0) return 'negative';
  return 'neutral';
}

function buildKpiCards(params: {
  report: DashboardProfitLossReport | null;
  periodData: DashboardPeriodData;
  dailyRows: readonly DashboardDailyMetricRow[];
  selectedMonth: number | null;
  isCustomRange: boolean;
}): DashboardKpiCardMetric[] {
  const { report, periodData, dailyRows, selectedMonth, isCustomRange } = params;
  const values = isCustomRange
    ? (() => {
        const sales = sumDailyMetric(dailyRows, 'totalAmount');
        const purchases = periodKindTotal(periodData, ['purchase']);
        const expenses = periodKindTotal(periodData, ['expense', 'fixed_expense', 'hr_expense']);
        const grossProfit = sales - purchases;
        const netProfit = grossProfit - expenses;
        return { sales, purchases, grossProfit, expenses, netProfit };
      })()
    : {
        sales: reportCardValue(report, 'sales', selectedMonth),
        purchases: reportCardValue(report, 'purchases', selectedMonth),
        grossProfit: reportCardValue(report, 'grossProfit', selectedMonth),
        expenses: reportCardValue(report, 'expenses', selectedMonth),
        netProfit: reportCardValue(report, 'netProfit', selectedMonth),
      };

  return (['sales', 'purchases', 'grossProfit', 'expenses', 'netProfit'] as const).map((key) => {
    const value = values[key];
    const pct = pctOfSales(key, value, values.sales);
    return { key, value, pct, tone: kpiTone(key, pct) };
  });
}

function buildDashboardTimelineMonthlyRows(
  report: DashboardProfitLossReport | null,
  yearDaily: readonly DashboardDailyMetricRow[],
): DashboardTimelineRow[] {
  const customersByMonth = new Map<number, number>();
  for (const row of yearDaily) {
    const month = monthNumberFromYmd(String(row.transactionDate));
    if (month == null) continue;
    customersByMonth.set(month, (customersByMonth.get(month) ?? 0) + Number(row.customerCount || 0));
  }

  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const sales = reportMonthValue(report, 'sales', index);
    const customers = customersByMonth.get(month) ?? 0;
    return {
      label: String(month),
      sales,
      purchases: reportMonthValue(report, 'purchases', index),
      expenses: reportMonthValue(report, 'expenses', index),
      customers,
      avgInvoice: customers > 0 ? sales / customers : 0,
    };
  });
}

function buildDashboardTimelineDailyRows(
  dailyRows: readonly DashboardDailyMetricRow[],
  startDate: string | null,
  endDate: string | null,
): DashboardTimelineRow[] {
  const byDay = new Map<number, { sales: number; customers: number }>();
  for (const row of dailyRows) {
    const day = dayNumberFromYmd(String(row.transactionDate));
    if (day == null) continue;
    const current = byDay.get(day) ?? { sales: 0, customers: 0 };
    current.sales += Number(row.totalAmount || 0);
    current.customers += Number(row.customerCount || 0);
    byDay.set(day, current);
  }

  return inclusiveDayRange(startDate, endDate).map((day) => {
    const current = byDay.get(day) ?? { sales: 0, customers: 0 };
    return {
      label: String(day),
      sales: current.sales,
      purchases: 0,
      expenses: 0,
      customers: current.customers,
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

    let ys = toYmd(yearStart);
    let ye = toYmd(yearEnd);
    let ds = dailyStart ? toYmd(dailyStart) : null;
    let de = dailyEnd ? toYmd(dailyEnd) : null;
    let ms = monthStart ? toYmd(monthStart) : null;
    let me = monthEnd ? toYmd(monthEnd) : null;
    let wys = weeklyYearStart ? toYmd(weeklyYearStart) : ys;
    let wye = weeklyYearEnd ? toYmd(weeklyYearEnd) : ye;
    let ws = weeklyStart ? toYmd(weeklyStart) : null;
    let we = weeklyEnd ? toYmd(weeklyEnd) : null;
    let wbs = weeklyBaselineStart ? toYmd(weeklyBaselineStart) : null;
    let wbe = weeklyBaselineEnd ? toYmd(weeklyBaselineEnd) : null;
    let pmys = previousMonthYearStart ? toYmd(previousMonthYearStart) : ys;
    let pmye = previousMonthYearEnd ? toYmd(previousMonthYearEnd) : ye;
    let pms = previousMonthStart ? toYmd(previousMonthStart) : null;
    let pme = previousMonthEnd ? toYmd(previousMonthEnd) : null;

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
      const cwy = clampSalesSummaryDateQuery(wys, wye, 7);
      wys = cwy.startDate;
      wye = cwy.endDate;
      if (ws && we) {
        const cw = clampSalesSummaryDateQuery(ws, we, 7);
        ws = cw.startDate;
        we = cw.endDate;
      }
      if (wbs && wbe) {
        const cwb = clampSalesSummaryDateQuery(wbs, wbe, 7);
        wbs = cwb.startDate;
        wbe = cwb.endDate;
      }
      const cpmy = clampSalesSummaryDateQuery(pmys, pmye, 7);
      pmys = cpmy.startDate;
      pmye = cpmy.endDate;
      if (pms && pme) {
        const cpm = clampSalesSummaryDateQuery(pms, pme, 7);
        pms = cpm.startDate;
        pme = cpm.endDate;
      }
    }

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
  async getCalendarData(companyId: string, tenantId: string, year: number, month: number) {
    const [monthRow, defaultRow] = await Promise.all([
      month !== 0
        ? this.prisma.dashboardCalendarData.findUnique({
            where: { companyId_year_month: { companyId, year, month } },
          })
        : Promise.resolve(null),
      this.prisma.dashboardCalendarData.findUnique({
        where: { companyId_year_month: { companyId, year, month: 0 } },
      }),
    ]);

    const monthTargets = normalizeCalendarTargets(monthRow?.targets);
    const defaultTargets = normalizeCalendarTargets(defaultRow?.targets);
    const hasMonthOverride = hasCalendarTargetOverride(monthTargets);
    const effectiveTargets = hasMonthOverride
      ? monthTargets
      : defaultTargets;

    return {
      targets: effectiveTargets,
      specialDays: normalizeCalendarSpecialDays(monthRow?.specialDays),
      dayNotes: normalizeCalendarDayNotes(monthRow?.dayNotes),
      isDefaultTargets: !hasMonthOverride,
      hasMonthOverride,
      defaultTargets,
    };
  }

  /**
   * يحفظ الأهداف:
   * - applyToAll=true  → يحفظ في month=0 (افتراضي لكل الشهور) ويحذف تخصيص الشهر الحالي
   * - applyToAll=false → يحفظ تخصيصاً للشهر المحدد فقط
   */
  async upsertCalendarTargets(
    companyId: string,
    tenantId: string,
    year: number,
    month: number,
    targets: unknown,
    applyToAll = true,
  ) {
    const normalizedTargets = normalizeCalendarTargets(targets);
    if (applyToAll) {
      // حفظ الهدف الافتراضي لكل الشهور (month=0)
      await this.prisma.dashboardCalendarData.upsert({
        where: { companyId_year_month: { companyId, year, month: 0 } },
        create: { companyId, tenantId, year, month: 0, targets: calendarTargetsJson(normalizedTargets) },
        update: { targets: calendarTargetsJson(normalizedTargets) },
      });
      // حذف تخصيص الشهر الحالي إن وُجد (سيسقط لـ الافتراضي تلقائياً)
      if (month !== 0) {
        const existing = await this.prisma.dashboardCalendarData.findUnique({
          where: { companyId_year_month: { companyId, year, month } },
        });
        if (existing && hasCalendarTargetOverride(normalizeCalendarTargets(existing.targets))) {
          await this.prisma.dashboardCalendarData.update({
            where: { companyId_year_month: { companyId, year, month } },
            data: { targets: calendarTargetsJson(DEFAULT_DASHBOARD_CALENDAR_DATA.targets) },
          });
        }
      }
    } else {
      // تخصيص الشهر المحدد فقط
      await this.prisma.dashboardCalendarData.upsert({
        where: { companyId_year_month: { companyId, year, month } },
        create: { companyId, tenantId, year, month, targets: calendarTargetsJson(normalizedTargets) },
        update: { targets: calendarTargetsJson(normalizedTargets) },
      });
    }
    return this.getCalendarData(companyId, tenantId, year, month);
  }

  /**
   * يُعيد الشهر للهدف الافتراضي (يحذف تخصيصه)
   */
  async resetMonthTargets(companyId: string, tenantId: string, year: number, month: number) {
    const row = await this.prisma.dashboardCalendarData.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });
    if (row) {
      await this.prisma.dashboardCalendarData.update({
        where: { companyId_year_month: { companyId, year, month } },
        data: { targets: calendarTargetsJson(DEFAULT_DASHBOARD_CALENDAR_DATA.targets) },
      });
    }
    return this.getCalendarData(companyId, tenantId, year, month);
  }

  async upsertCalendarSpecialDays(
    companyId: string,
    tenantId: string,
    year: number,
    month: number,
    specialDays: unknown,
  ) {
    const normalizedSpecialDays = normalizeCalendarSpecialDays(specialDays);
    await this.prisma.dashboardCalendarData.upsert({
      where: { companyId_year_month: { companyId, year, month } },
      create: { companyId, tenantId, year, month, specialDays: specialDaysJson(normalizedSpecialDays) },
      update: { specialDays: specialDaysJson(normalizedSpecialDays) },
    });
    return this.getCalendarData(companyId, tenantId, year, month);
  }

  getSaudiOccasions(year: number) {
    return getSaudiOccasionsForYear(year);
  }

  private async resolveAllowedCompanyIds(
    user: JwtUser,
    tenantId: string,
    sourceCompanyId: string,
    scope: 'company' | 'tenant',
    requestedCompanyIds?: string[],
  ): Promise<string[]> {
    if (scope === 'company') return [sourceCompanyId];

    const role = (user.role || '').toLowerCase();
    if (isSuperAdmin(role)) {
      const all = await this.prisma.company.findMany({
        where: { tenantId },
        select: { id: true },
      });
      return all.map((c) => c.id);
    }

    const ids = (requestedCompanyIds?.length ? requestedCompanyIds : user.companyIds) ?? [];
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return [sourceCompanyId];

    const rows = await this.prisma.company.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * يدمج مناسبات سعودية مختارة في specialDays لكل شهر متأثر.
   */
  async applySaudiSpecialOccasions(
    user: JwtUser,
    tenantId: string,
    sourceCompanyId: string,
    year: number,
    occasionIds: string[],
    scope: 'company' | 'tenant',
    lang: 'ar' | 'en',
    requestedCompanyIds?: string[],
    dayShifts?: Record<string, number>,
  ): Promise<{ companies: number; monthsUpdated: number; occasionCount: number }> {
    const catalog = getSaudiOccasionsForYear(year);
    const selected = catalog
      .filter((o) => occasionIds.includes(o.id))
      .map((o) => {
        const raw = dayShifts?.[o.id];
        const shift =
          typeof raw === 'number' && Number.isFinite(raw)
            ? Math.max(-3, Math.min(3, Math.trunc(raw)))
            : 0;
        if (!shift) return o;
        return {
          ...o,
          fromDate: shiftGregorianYmd(o.fromDate, shift),
          toDate: shiftGregorianYmd(o.toDate, shift),
        };
      });
    if (!selected.length) {
      return { companies: 0, monthsUpdated: 0, occasionCount: 0 };
    }

    const companyIds = await this.resolveAllowedCompanyIds(
      user,
      tenantId,
      sourceCompanyId,
      scope,
      requestedCompanyIds,
    );

    const byMonth = occasionsToSpecialDayPeriods(year, selected, lang);
    let monthsUpdated = 0;

    for (const companyId of companyIds) {
      for (const [month, periods] of byMonth.entries()) {
        const row = await this.prisma.dashboardCalendarData.findUnique({
          where: { companyId_year_month: { companyId, year, month } },
        });
        const existing = normalizeCalendarSpecialDays(row?.specialDays);
        const merged = mergeSpecialDayPeriods(existing, periods);
        await this.prisma.dashboardCalendarData.upsert({
          where: { companyId_year_month: { companyId, year, month } },
          create: {
            companyId,
            tenantId,
            year,
            month,
            specialDays: specialDaysJson(merged),
          },
          update: { specialDays: specialDaysJson(merged) },
        });
        monthsUpdated += 1;
      }
    }

    return {
      companies: companyIds.length,
      monthsUpdated,
      occasionCount: selected.length,
    };
  }

  async upsertCalendarDayNotes(
    companyId: string,
    tenantId: string,
    year: number,
    month: number,
    dayNotes: unknown,
  ) {
    const normalizedDayNotes = normalizeCalendarDayNotes(dayNotes);
    await this.prisma.dashboardCalendarData.upsert({
      where: { companyId_year_month: { companyId, year, month } },
      create: { companyId, tenantId, year, month, dayNotes: dayNotesJson(normalizedDayNotes) },
      update: { dayNotes: dayNotesJson(normalizedDayNotes) },
    });
    return this.getCalendarData(companyId, tenantId, year, month);
  }
}

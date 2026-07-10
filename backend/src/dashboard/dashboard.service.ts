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

const EMPTY_SALES_PACK = { yearSummaries: [], dailySummaries: [], monthSummaries: [] } as const;

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

/**
 * SalesService — طبقة رفيعة (Thin Layer) فوق FinancialCoreService
 *
 * createSummary يُفوَّض بالكامل → FinancialCoreService.processInflow
 * findAll تبقى هنا (قراءة بحتة).
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma }                from '@prisma/client';
import { TenantPrismaService }   from '../prisma/tenant-prisma.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { toYmd } from '../common/utils/to-ymd.util';
import { nowSaudi } from '../common/utils/date-utils';

type DashboardDailyMetricRow = {
  transactionDate: string;
  shift: string;
  totalAmount: string;
  customerCount: number;
};

function ymdParts(value: string): { year: number; month: number; day: number } | null {
  const ymd = toYmd(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const year = Number(ymd.slice(0, 4));
  const month = Number(ymd.slice(5, 7));
  const day = Number(ymd.slice(8, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  return { year, month, day };
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function periodDailyAverage(rows: readonly DashboardDailyMetricRow[], endDayInclusive?: number) {
  if (!rows.length) return { total: 0, customerCount: 0, calendarDays: 0, revenueAvgDaily: null, customerAvgDaily: null };
  const first = ymdParts(rows[0].transactionDate);
  if (!first) return { total: 0, customerCount: 0, calendarDays: 0, revenueAvgDaily: null, customerAvgDaily: null };
  const cap = Math.max(0, Math.min(endDayInclusive ?? lastDayOfMonth(first.year, first.month), lastDayOfMonth(first.year, first.month)));
  let total = 0;
  let customerCount = 0;
  for (const row of rows) {
    const parts = ymdParts(row.transactionDate);
    if (!parts || parts.year !== first.year || parts.month !== first.month || parts.day > cap) continue;
    total += Number(row.totalAmount || 0);
    customerCount += row.customerCount || 0;
  }
  return {
    total,
    customerCount,
    calendarDays: cap,
    revenueAvgDaily: cap > 0 ? total / cap : null,
    customerAvgDaily: cap > 0 ? customerCount / cap : null,
  };
}

function weeklyRows(rows: readonly DashboardDailyMetricRow[]) {
  if (!rows.length) return [];
  const first = ymdParts(rows[0].transactionDate);
  if (!first) return [];
  const ld = lastDayOfMonth(first.year, first.month);
  const byDay = new Map<number, { total: number; customers: number }>();
  for (const row of rows) {
    const parts = ymdParts(row.transactionDate);
    if (!parts || parts.year !== first.year || parts.month !== first.month) continue;
    const prev = byDay.get(parts.day) ?? { total: 0, customers: 0 };
    prev.total += Number(row.totalAmount || 0);
    prev.customers += row.customerCount || 0;
    byDay.set(parts.day, prev);
  }
  const out: Array<{
    weekIndex: number;
    dayStart: number;
    dayEnd: number;
    totalSales: number;
    avgDailyInWeek: number;
    calendarDaysInSlice: number;
  }> = [];
  let dayStart = 1;
  let weekIndex = 1;
  while (dayStart <= ld) {
    const dayEnd = Math.min(dayStart + 6, ld);
    let totalSales = 0;
    for (let day = dayStart; day <= dayEnd; day += 1) {
      totalSales += byDay.get(day)?.total ?? 0;
    }
    const calendarDaysInSlice = dayEnd - dayStart + 1;
    out.push({
      weekIndex,
      dayStart,
      dayEnd,
      totalSales,
      avgDailyInWeek: calendarDaysInSlice > 0 ? totalSales / calendarDaysInSlice : 0,
      calendarDaysInSlice,
    });
    dayStart = dayEnd + 1;
    weekIndex += 1;
  }
  return out;
}

function monthlyDailyAverages(rows: readonly DashboardDailyMetricRow[]) {
  const saudiNow = nowSaudi();
  const currentYear = saudiNow.getFullYear();
  const currentMonth = saudiNow.getMonth() + 1;
  const currentDay = saudiNow.getDate();
  const byMonth = new Map<string, DashboardDailyMetricRow[]>();
  for (const row of rows) {
    const parts = ymdParts(row.transactionDate);
    if (!parts) continue;
    const key = `${parts.year}-${String(parts.month).padStart(2, '0')}`;
    byMonth.set(key, [...(byMonth.get(key) ?? []), row]);
  }
  let previousAvg: number | null = null;
  return Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodKey, monthRows]) => {
      const first = ymdParts(`${periodKey}-01`);
      const endDay =
        first && first.year === currentYear && first.month === currentMonth
          ? currentDay
          : undefined;
      const avg = periodDailyAverage(monthRows, endDay);
      const deltaPctVsPrev =
        avg.revenueAvgDaily != null && previousAvg != null && Math.abs(previousAvg) > 1e-9
          ? ((avg.revenueAvgDaily - previousAvg) / Math.abs(previousAvg)) * 100
          : null;
      const tone =
        avg.revenueAvgDaily == null || previousAvg == null
          ? 'neutral'
          : avg.revenueAvgDaily > previousAvg
            ? 'up'
            : avg.revenueAvgDaily < previousAvg
              ? 'down'
              : 'neutral';
      if (avg.revenueAvgDaily != null) previousAvg = avg.revenueAvgDaily;
      return {
        periodKey,
        month: first?.month ?? 0,
        totalSales: avg.total > 0 ? avg.total : null,
        avgDaily: avg.revenueAvgDaily,
        calendarDays: avg.calendarDays,
        deltaPctVsPrev,
        tone,
        isCurrentMonth: first?.year === currentYear && first.month === currentMonth,
      };
    });
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma:        TenantPrismaService,
    private readonly financialCore: FinancialCoreService,
  ) {}

  /**
   * إنشاء ملخص مبيعات يومي — يُفوَّض للمحرك المالي المركزي.
   * الـ transaction الكاملة (ملخص + قنوات + قيود + تدقيق) داخل FinancialCoreService.
   */
  async createSummary(dto: {
    companyId:       string;
    transactionDate: string;
    customerCount:   number;
    shift?:          'morning' | 'evening' | 'all';
    cashOnHand:      string;
    channels:        { vaultId: string; amount: string }[];
    notes?:          string;
    idempotencyKey?: string;
    userId?:         string;
  }) {
    const result = await this.financialCore.processInflow(
      {
        companyId:       dto.companyId,
        transactionDate: dto.transactionDate,
        customerCount:   dto.customerCount,
        shift:           dto.shift,
        cashOnHand:      dto.cashOnHand,
        channels:        dto.channels,
        notes:           dto.notes,
        idempotencyKey:  dto.idempotencyKey,
      },
      dto.userId,
    );
    const summary = await this.loadSummaryWithChannels(result.summary.id, dto.companyId);
    return { ...result, summary: summary ?? result.summary };
  }

  /** عدة ملخصات (شفتان كحد أقصى) في معاملة واحدة — للإدخال الديناميكي */
  async createSummaryBatch(dto: {
    companyId:            string;
    transactionDate:      string;
    items:                {
      shift:          'morning' | 'evening' | 'all';
      customerCount:  number;
      cashOnHand?:    string;
      channels:       { vaultId: string; amount: string }[];
      notes?:         string;
    }[];
    batchIdempotencyKey?: string;
    userId?:              string;
  }) {
    const inflowDtos = dto.items.map((item) => ({
      companyId:       dto.companyId,
      transactionDate: dto.transactionDate,
      customerCount:   item.customerCount,
      shift:           item.shift,
      cashOnHand:      item.cashOnHand ?? '0',
      channels:        item.channels,
      notes:           item.notes,
    }));
    const batch = await this.financialCore.processInflowBatch(
      inflowDtos,
      dto.userId,
      dto.batchIdempotencyKey,
    );
    const summaries = await Promise.all(
      (batch.summaries || []).map(async (s) => {
        const full = await this.loadSummaryWithChannels(s.id, dto.companyId);
        return full ?? s;
      }),
    );
    return { ...batch, summaries };
  }

  private async loadSummaryWithChannels(id: string, companyId: string) {
    return this.prisma.dailySalesSummary.findFirst({
      where: { id, companyId },
      include: this.dailySalesSummaryListInclude(),
    });
  }

  /** تضمين موحّد لقنوات الملخص — يُستخدم في القائمة وحزمة الداشبورد. */
  private dailySalesSummaryListInclude(): Prisma.DailySalesSummaryInclude {
    return {
      channels: {
        orderBy: [
          { vault: { sortOrder: 'asc' } },
          { vault: { nameAr: 'asc' } },
        ],
        include: {
          vault: { select: { id: true, nameAr: true, nameEn: true, type: true, paymentMethod: true, sortOrder: true } },
        },
      },
      createdBy: { select: { nameAr: true } },
    };
  }

  private salesSummaryDateWhere(
    companyId: string,
    startDate: string,
    endDate: string,
    includeCancelled: boolean,
  ): Prisma.DailySalesSummaryWhereInput {
    const statusFilter: Prisma.DailySalesSummaryWhereInput = includeCancelled
      ? { status: { in: ['active', 'cancelled'] } }
      : { status: 'active' };
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
      where: this.salesSummaryDateWhere(companyId, startDate, endDate, includeCancelled),
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

    return this.prisma.$queryRaw<Array<{
      periodKey: string;
      vaultId: string;
      nameAr: string;
      nameEn: string | null;
      type: string | null;
      amount: string;
    }>>(Prisma.sql`
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

  /**
   * حزمة واحدة للوحة التحكم: سنة كاملة + نطاق يومي + نطاق شهري — استعلامات متوازية بدل حلقات HTTP.
   */
  async findDashboardPack(
    companyId: string,
    ranges: {
      yearStart: string;
      yearEnd: string;
      dailyStart?: string | null;
      dailyEnd?: string | null;
      monthStart?: string | null;
      monthEnd?: string | null;
    },
    includeCancelled = false,
  ) {
    const statusFilter: Prisma.DailySalesSummaryWhereInput = includeCancelled
      ? { status: { in: ['active', 'cancelled'] } }
      : { status: 'active' };
    const inc = this.dailySalesSummaryListInclude();
    const orderBy: Prisma.DailySalesSummaryOrderByWithRelationInput[] = [
      { transactionDate: 'asc' },
      { summaryNumber: 'asc' },
    ];

    const y0 = toYmd(ranges.yearStart);
    const y1 = toYmd(ranges.yearEnd);
    const yearWhere: Prisma.DailySalesSummaryWhereInput = {
      companyId,
      ...statusFilter,
      transactionDate: {
        gte: new Date(`${y0}T00:00:00.000Z`),
        lte: new Date(`${y1}T23:59:59.999Z`),
      },
    };

    const dailyWhere: Prisma.DailySalesSummaryWhereInput | null =
      ranges.dailyStart && ranges.dailyEnd
        ? {
            companyId,
            ...statusFilter,
            transactionDate: {
              gte: new Date(`${toYmd(ranges.dailyStart)}T00:00:00.000Z`),
              lte: new Date(`${toYmd(ranges.dailyEnd)}T23:59:59.999Z`),
            },
          }
        : null;

    const monthWhere: Prisma.DailySalesSummaryWhereInput | null =
      ranges.monthStart && ranges.monthEnd
        ? {
            companyId,
            ...statusFilter,
            transactionDate: {
              gte: new Date(`${toYmd(ranges.monthStart)}T00:00:00.000Z`),
              lte: new Date(`${toYmd(ranges.monthEnd)}T23:59:59.999Z`),
            },
          }
        : null;

    const [yearSummaries, dailySummaries, monthSummaries, yearDailyMetrics, yearChannelMetrics, dailyDailyMetrics, dailyChannelMetrics, monthDailyMetrics] = await Promise.all([
      this.prisma.dailySalesSummary.findMany({
        where: yearWhere,
        orderBy,
        take: 4000,
        include: inc,
      }),
      dailyWhere
        ? this.prisma.dailySalesSummary.findMany({
            where: dailyWhere,
            orderBy,
            take: 500,
            include: inc,
          })
        : Promise.resolve([]),
      monthWhere
        ? this.prisma.dailySalesSummary.findMany({
            where: monthWhere,
            orderBy,
            take: 500,
            include: inc,
          })
        : Promise.resolve([]),
      this.buildDashboardDailyMetricRows(companyId, y0, y1, includeCancelled),
      this.buildDashboardChannelMetricRows(companyId, y0, y1, includeCancelled),
      dailyWhere && ranges.dailyStart && ranges.dailyEnd
        ? this.buildDashboardDailyMetricRows(companyId, ranges.dailyStart, ranges.dailyEnd, includeCancelled)
        : Promise.resolve([]),
      dailyWhere && ranges.dailyStart && ranges.dailyEnd
        ? this.buildDashboardChannelMetricRows(companyId, ranges.dailyStart, ranges.dailyEnd, includeCancelled)
        : Promise.resolve([]),
      monthWhere && ranges.monthStart && ranges.monthEnd
        ? this.buildDashboardDailyMetricRows(companyId, ranges.monthStart, ranges.monthEnd, includeCancelled)
        : Promise.resolve([]),
    ]);

    return {
      yearSummaries,
      dailySummaries,
      monthSummaries,
      metrics: {
        yearDaily: yearDailyMetrics,
        yearChannels: yearChannelMetrics,
        dailyDaily: dailyDailyMetrics,
        dailyChannels: dailyChannelMetrics,
        monthDaily: monthDailyMetrics,
        monthAverage: periodDailyAverage(monthDailyMetrics),
        dailyWeekly: weeklyRows(dailyDailyMetrics),
        yearMonthlyDailyAverages: monthlyDailyAverages(yearDailyMetrics),
      },
    };
  }

  /**
   * جلب ملخصات المبيعات مع فلترة التاريخ والتصفح.
   */
  async findAll(
    companyId: string,
    startDate?: string,
    endDate?:   string,
    page       = 1,
    pageSize   = 30,
    q?:         string,
    sortBy = 'transactionDate',
    sortDir: 'asc' | 'desc' | string = 'desc',
    includeCancelled = false,
    shift?: string,
  ) {
    const dateFilter =
      startDate || endDate
        ? {
            transactionDate: {
              ...(startDate
                ? { gte: new Date(`${toYmd(startDate)}T00:00:00.000Z`) }
                : {}),
              ...(endDate
                ? { lte: new Date(`${toYmd(endDate)}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {};

    const statusFilter: Prisma.DailySalesSummaryWhereInput = includeCancelled
      ? { status: { in: ['active', 'cancelled'] } }
      : { status: 'active' };

    const needle = (q || '').trim();
    const searchFilter =
      needle.length > 0
        ? {
            OR: [
              { summaryNumber: { contains: needle, mode: 'insensitive' as const } },
              { notes: { contains: needle, mode: 'insensitive' as const } },
            ],
          }
        : {};

    const where = { companyId, ...statusFilter, ...dateFilter, ...searchFilter };
    const shiftFilter =
      shift === 'morning' || shift === 'evening' || shift === 'all'
        ? { shift }
        : {};
    const whereWithShift = { ...where, ...shiftFilter };

    const dir: Prisma.SortOrder = String(sortDir).toLowerCase() === 'asc' ? 'asc' : 'desc';
    const allowed = new Set(['transactionDate', 'summaryNumber', 'totalAmount', 'customerCount', 'createdAt']);
    const field = allowed.has(sortBy) ? sortBy : 'transactionDate';
    const orderBy: Prisma.DailySalesSummaryOrderByWithRelationInput[] = [
      { [field]: dir },
    ];
    if (field !== 'transactionDate') {
      orderBy.push({ transactionDate: 'desc' });
    }

    const size = Math.min(200, Math.max(1, pageSize));
    const p = Math.max(1, page);

    const [items, total] = await Promise.all([
      this.prisma.dailySalesSummary.findMany({
        where: whereWithShift,
        orderBy,
        skip:    (p - 1) * size,
        take:    size,
        include: this.dailySalesSummaryListInclude(),
      }),
      this.prisma.dailySalesSummary.count({ where: whereWithShift }),
    ]);

    return { items, total, page: p, pageSize: size };
  }

  /** تحديث شفت الملخص فقط — لا يمس القيود أو القنوات */
  async patchSummaryShift(
    id: string,
    companyId: string,
    shift: 'morning' | 'evening' | 'all',
  ) {
    const updated = await this.prisma.dailySalesSummary.updateMany({
      where: { id, companyId, status: 'active' },
      data: { shift },
    });
    if (updated.count === 0) {
      throw new NotFoundException('الملخص غير موجود أو تم إلغاؤه.');
    }
    return { ok: true, shift };
  }

  /**
   * تحديث ملخص مبيعات — يلغي القيود القديمة وينشئ قيوداً جديدة.
   */
  async updateSummary(
    id: string,
    companyId: string,
    dto: {
      transactionDate?: string;
      customerCount?: number;
      shift?: 'morning' | 'evening' | 'all';
      cashOnHand?: string;
      channels?: { vaultId: string; amount: string }[];
      notes?: string;
    },
    userId?: string,
  ) {
    const summary = await this.prisma.dailySalesSummary.findFirst({
      where: { id, companyId, status: 'active' },
      include: { channels: true },
    });
    if (!summary) {
      throw new Error('الملخص غير موجود أو تم إلغاؤه.');
    }
    if (!dto.channels?.length) {
      throw new Error('يجب إدخال قناة بيع واحدة على الأقل.');
    }
    const totalAmount = dto.channels.reduce(
      (sum, ch) => sum.plus(new Prisma.Decimal(ch.amount || '0')),
      new Prisma.Decimal(0),
    );
    if (totalAmount.lte(0)) {
      throw new Error('يجب أن يكون إجمالي المبيعات أكبر من صفر.');
    }

    return this.financialCore.updateInflow(id, companyId, {
      transactionDate: dto.transactionDate ?? toYmd(summary.transactionDate),
      customerCount:   dto.customerCount ?? summary.customerCount,
      shift:           dto.shift ?? ((summary as { shift?: 'morning' | 'evening' | 'all' }).shift ?? 'all'),
      cashOnHand:      dto.cashOnHand ?? String(summary.cashOnHand),
      channels:        dto.channels,
      notes:           dto.notes ?? summary.notes ?? undefined,
    }, userId);
  }

  /** إلغاء ملخص مبيعات (لا حذف — Status: cancelled) */
  async cancelSummary(id: string, companyId: string, userId?: string) {
    return this.financialCore.cancelOperation(
      { referenceType: 'sale', referenceId: id, companyId, reason: 'إلغاء من واجهة المبيعات' },
      userId,
    );
  }
}

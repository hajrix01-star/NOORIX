import { Inject, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import moment from 'moment-timezone';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ReportsService } from '../reports/reports.service';
import type { GeneralProfitLossModel } from '../reports/reports-general-profit-loss-model.util';
import { SalesService } from '../sales/sales.service';
import { normalizeOwnerDailySalesItems, type OwnerOverviewDailySalesItem } from './owner-overview-model.util';

type MetricKey = 'sales' | 'purchases' | 'expenses';
type Direction = 'up' | 'down' | 'stable';

type CompanyReference = { id: string; nameAr: string; nameEn: string | null };

type AdminDashboardPrisma = {
  company: {
    findMany(args: {
      where: { id: { in: string[] }; isArchived: false; tenantId: string };
      select: { id: true; nameAr: true; nameEn: true };
    }): Promise<CompanyReference[]>;
  };
};

type AdminDashboardReports = {
  getGeneralProfitLoss(companyId: string, year: number): Promise<GeneralProfitLossModel>;
};

type AdminDashboardSales = {
  findDashboardPack(
    companyId: string,
    range: { yearStart: string; yearEnd: string; dailyStart: string; dailyEnd: string },
    includeArchived: boolean,
  ): Promise<{ dailySummaries: unknown[] }>;
};

type MonthReference = { month: number; year: number };

function allowedCompanyIds(): string[] {
  return [...new Set((process.env.ADMIN_DASHBOARD_COMPANY_IDS ?? '').split(',').map((id) => id.trim()).filter(Boolean))];
}

function monthReference(value: moment.Moment): MonthReference {
  return { month: value.month() + 1, year: value.year() };
}

function reportValue(report: GeneralProfitLossModel, metric: MetricKey, month: number): number {
  const group = report.groups.find((entry) => entry.key === metric);
  const raw = group?.months[month - 1];
  if (raw == null || raw === '') throw new Error(`Missing ${metric} value for month ${month}`);
  const value = new Decimal(raw);
  if (!value.isFinite()) throw new Error(`Invalid ${metric} value for month ${month}`);
  return value.toNumber();
}

function metric(current: number, previous: number) {
  const direction: Direction = current > previous ? 'up' : current < previous ? 'down' : 'stable';
  const changePercent = previous === 0
    ? current === 0 ? 0 : null
    : new Decimal(current).minus(previous).div(new Decimal(previous).abs()).mul(100).toDecimalPlaces(2).toNumber();
  return { changePercent, current, direction, previous };
}

function dateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function dailyAverage(items: OwnerOverviewDailySalesItem[], start: string, end: string, days: number): number {
  const total = items.reduce((sum, item) => {
    const date = dateKey(item.transactionDate);
    if (!date || date < start || date > end || item.status === 'cancelled') return sum;
    if (item.totalAmount == null || item.totalAmount === '') throw new Error(`Missing daily sales amount for ${date}`);
    const amount = new Decimal(item.totalAmount);
    if (!amount.isFinite()) throw new Error(`Invalid daily sales amount for ${date}`);
    return sum.plus(amount);
  }, new Decimal(0));
  return total.div(days).toDecimalPlaces(2).toNumber();
}

@Injectable()
export class OwnerAdminDashboardService {
  constructor(
    @Inject(TenantPrismaService) private readonly prisma: AdminDashboardPrisma,
    @Inject(ReportsService) private readonly reportsService: AdminDashboardReports,
    @Inject(SalesService) private readonly salesService: AdminDashboardSales,
  ) {}

  async getSnapshot(tenantId: string) {
    const companyIds = allowedCompanyIds();
    if (companyIds.length === 0) throw new Error('ADMIN_DASHBOARD_COMPANY_IDS is not configured');

    const now = moment().tz('Asia/Riyadh');
    const currentStart = now.clone().startOf('month');
    const previousStart = currentStart.clone().subtract(1, 'month');
    const previousEnd = previousStart.clone().endOf('month');
    const historyWithComparison = Array.from({ length: 7 }, (_, index) => monthReference(currentStart.clone().subtract(index, 'month')));
    const history = historyWithComparison.slice(0, 6);
    const reportYears = [...new Set(historyWithComparison.map((entry) => entry.year))];

    const companies = await this.prisma.company.findMany({
      where: { id: { in: companyIds }, isArchived: false, tenantId },
      select: { id: true, nameAr: true, nameEn: true },
    });

    const companyData = await Promise.all(companies.map(async (company) => {
      const [reports, salesPack] = await Promise.all([
        Promise.all(reportYears.map(async (year) => ({ year, report: await this.reportsService.getGeneralProfitLoss(company.id, year) }))),
        this.salesService.findDashboardPack(company.id, {
          yearStart: `${Math.min(...reportYears)}-01-01`,
          yearEnd: `${Math.max(...reportYears)}-12-31`,
          dailyStart: previousStart.format('YYYY-MM-DD'),
          dailyEnd: now.format('YYYY-MM-DD'),
        }, false),
      ]);
      const reportByYear = new Map(reports.map((entry) => [entry.year, entry.report]));
      const currentRef = monthReference(now);
      const previousRef = monthReference(previousStart);
      const currentReport = reportByYear.get(currentRef.year);
      const previousReport = reportByYear.get(previousRef.year);
      if (!currentReport || !previousReport) throw new Error(`Missing report for company ${company.id}`);

      const currentValues = {
        sales: reportValue(currentReport, 'sales', currentRef.month),
        purchases: reportValue(currentReport, 'purchases', currentRef.month),
        expenses: reportValue(currentReport, 'expenses', currentRef.month),
      };
      const previousValues = {
        sales: reportValue(previousReport, 'sales', previousRef.month),
        purchases: reportValue(previousReport, 'purchases', previousRef.month),
        expenses: reportValue(previousReport, 'expenses', previousRef.month),
      };
      const dailyItems = normalizeOwnerDailySalesItems(salesPack.dailySummaries);

      return {
        companyId: company.id,
        nameAr: company.nameAr,
        nameEn: company.nameEn,
        sales: metric(currentValues.sales, previousValues.sales),
        purchases: metric(currentValues.purchases, previousValues.purchases),
        expenses: metric(currentValues.expenses, previousValues.expenses),
        dailySalesAverage: {
          currentMonthToDate: dailyAverage(dailyItems, currentStart.format('YYYY-MM-DD'), now.format('YYYY-MM-DD'), now.date()),
          previousFullMonth: dailyAverage(dailyItems, previousStart.format('YYYY-MM-DD'), previousEnd.format('YYYY-MM-DD'), previousEnd.date()),
        },
        monthlyPerformance: history.map(({ year, month }, index) => {
          const report = reportByYear.get(year);
          const previousMonth = historyWithComparison[index + 1];
          const previousMonthReport = previousMonth ? reportByYear.get(previousMonth.year) : null;
          if (!report || !previousMonth || !previousMonthReport) throw new Error(`Missing report for ${company.id}/${year}`);
          return {
            year,
            month,
            sales: metric(reportValue(report, 'sales', month), reportValue(previousMonthReport, 'sales', previousMonth.month)),
            purchases: metric(reportValue(report, 'purchases', month), reportValue(previousMonthReport, 'purchases', previousMonth.month)),
            expenses: metric(reportValue(report, 'expenses', month), reportValue(previousMonthReport, 'expenses', previousMonth.month)),
          };
        }),
      };
    }));

    return {
      schemaVersion: 2 as const,
      observedAt: now.toISOString(),
      currency: 'SAR',
      currentPeriod: {
        kind: 'month-to-date' as const,
        year: now.year(),
        month: now.month() + 1,
        startDate: currentStart.format('YYYY-MM-DD'),
        endDate: now.format('YYYY-MM-DD'),
      },
      previousPeriod: {
        kind: 'full-month' as const,
        year: previousStart.year(),
        month: previousStart.month() + 1,
        startDate: previousStart.format('YYYY-MM-DD'),
        endDate: previousEnd.format('YYYY-MM-DD'),
      },
      companies: companyData,
    };
  }
}

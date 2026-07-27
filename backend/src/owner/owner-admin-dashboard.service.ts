import { Inject, Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import moment from 'moment-timezone';
import { toYmd } from '../common/utils/to-ymd.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ReportsService } from '../reports/reports.service';
import type { GeneralProfitLossModel } from '../reports/reports-general-profit-loss-model.util';
import {
  periodDailyAverage,
  selectedMonthAverageEndDay,
  type DashboardDailyMetricRow,
} from '../sales/sales-dashboard-metrics.util';
import { buildOwnerAdminDashboardExecutiveSnapshot, type OwnerExecutiveDailySalesSource, type OwnerExecutiveSalesChannelSource } from './owner-admin-dashboard-executive-snapshot.util';

type MetricKey = 'sales' | 'purchases' | 'expenses';
type Direction = 'up' | 'down' | 'stable';

type CompanyReference = { id: string; nameAr: string; nameEn: string | null };

type AdminDashboardPrisma = {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  company: {
    findMany(args: { where: { id: { in: string[] }; isArchived: false; tenantId: string }; select: { id: true; nameAr: true; nameEn: true } }): Promise<CompanyReference[]>;
  };
};

type ExecutiveDailySalesRow = { amount: string; date: Date | string };
type ExecutiveCustomerRow = {
  customerCount: number;
  date: Date | string;
  shift: string;
};
type ExecutiveSalesChannelRow = {
  amount: string;
  id: string;
  labelAr: string;
  labelEn: string | null;
};

type AdminDashboardReports = {
  getGeneralProfitLoss(companyId: string, year: number): Promise<GeneralProfitLossModel>;
  getGeneralProfitLossPeriodTotals(companyId: string, startDate: string, endDate: string): Promise<{ expenses: string; purchases: string; sales: string }>;
};

type MonthReference = { month: number; year: number };

function allowedCompanyIds(): string[] {
  return [
    ...new Set(
      (process.env.ADMIN_DASHBOARD_COMPANY_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

function monthReference(value: moment.Moment): MonthReference {
  return { month: value.month() + 1, year: value.year() };
}

function utcDateBoundary(value: moment.Moment, endOfDay = false): Date {
  return new Date(`${value.format('YYYY-MM-DD')}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
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
  const changePercent = previous === 0 ? (current === 0 ? 0 : null) : new Decimal(current).minus(previous).div(new Decimal(previous).abs()).mul(100).toDecimalPlaces(2).toNumber();
  return { changePercent, current, direction, previous };
}

function periodValue(value: string, metricName: MetricKey): number {
  const amount = new Decimal(value);
  if (!amount.isFinite()) throw new Error(`Invalid ${metricName} period amount`);
  return amount.toNumber();
}

function roundedAverage(value: number | null): number | null {
  return value === null
    ? null
    : new Decimal(value).toDecimalPlaces(2).toNumber();
}

@Injectable()
export class OwnerAdminDashboardService {
  constructor(
    @Inject(TenantPrismaService) private readonly prisma: AdminDashboardPrisma,
    @Inject(ReportsService)
    private readonly reportsService: AdminDashboardReports,
  ) {}

  private async loadExecutiveDailySales(companyId: string, startDate: Date, endDate: Date): Promise<OwnerExecutiveDailySalesSource[]> {
    return this.prisma.$queryRaw<ExecutiveDailySalesRow[]>`
      WITH channel_sales AS (
        SELECT dss.transaction_date::date AS date, SUM(dsc.amount) AS amount
        FROM daily_sales_channels dsc
        JOIN daily_sales_summaries dss ON dsc.summary_id = dss.id
        WHERE dss.company_id = ${companyId}
          AND dss.status = 'active'
          AND dss.transaction_date BETWEEN ${startDate} AND ${endDate}
        GROUP BY dss.transaction_date::date
      ), other_ledger_sales AS (
        SELECT le.transaction_date::date AS date, SUM(le.amount) AS amount
        FROM ledger_entries le
        JOIN accounts ca ON ca.id = le.credit_account_id
        LEFT JOIN invoices i ON (
          i.company_id = le.company_id
          AND (
            (le.reference_type IN ('invoice', 'salary', 'advance') AND i.id = le.reference_id)
            OR (le.reference_type = 'sale' AND i.daily_sales_summary_id = le.reference_id)
          )
        )
        WHERE le.company_id = ${companyId}
          AND le.status = 'active'
          AND ca.type = 'revenue'
          AND (i.kind IS NULL OR i.kind <> 'sale')
          AND le.transaction_date BETWEEN ${startDate} AND ${endDate}
        GROUP BY le.transaction_date::date
      )
      SELECT date, SUM(amount)::text AS amount
      FROM (
        SELECT date, amount FROM channel_sales
        UNION ALL
        SELECT date, amount FROM other_ledger_sales
      ) source_sales
      GROUP BY date
      ORDER BY date ASC
    `;
  }

  private async loadExecutiveSalesChannels(companyId: string, startDate: Date, endDate: Date): Promise<OwnerExecutiveSalesChannelSource[]> {
    return this.prisma.$queryRaw<ExecutiveSalesChannelRow[]>`
      SELECT
        v.id AS id,
        v.name_ar AS "labelAr",
        v.name_en AS "labelEn",
        SUM(dsc.amount)::text AS amount
      FROM daily_sales_channels dsc
      JOIN daily_sales_summaries dss ON dsc.summary_id = dss.id
      JOIN vaults v ON dsc.vault_id = v.id
      WHERE dss.company_id = ${companyId}
        AND dss.status = 'active'
        AND dss.transaction_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY v.id, v.name_ar, v.name_en
      ORDER BY v.id ASC
    `;
  }

  private async loadCustomerDailyMetrics(
    companyId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DashboardDailyMetricRow[]> {
    const rows = await this.prisma.$queryRaw<ExecutiveCustomerRow[]>`
      SELECT
        dss.transaction_date::date AS date,
        dss.shift AS shift,
        SUM(dss.customer_count)::int AS "customerCount"
      FROM daily_sales_summaries dss
      WHERE dss.company_id = ${companyId}
        AND dss.status = 'active'
        AND dss.transaction_date BETWEEN ${startDate} AND ${endDate}
      GROUP BY dss.transaction_date::date, dss.shift
      ORDER BY dss.transaction_date::date ASC, dss.shift ASC
    `;

    return rows.map((row) => {
      const date = toYmd(row.date);
      const customerCount = Number(row.customerCount);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !Number.isInteger(customerCount)
        || customerCount < 0
      ) {
        throw new Error('Invalid customer daily metric');
      }
      return {
        customerCount,
        transactionDate: date,
        shift: row.shift,
        totalAmount: '0',
      };
    });
  }

  async getSnapshot(tenantId: string) {
    const companyIds = allowedCompanyIds();
    if (companyIds.length === 0) throw new Error('ADMIN_DASHBOARD_COMPANY_IDS is not configured');

    const now = moment().tz('Asia/Riyadh');
    const latestCompleteDay = now.clone().startOf('day').subtract(1, 'day');
    const executiveWindowStart = latestCompleteDay.clone().subtract(13, 'days');
    const executiveComparisonStart = executiveWindowStart.clone().subtract(1, 'day');
    const executiveMonthStart = latestCompleteDay.clone().startOf('month');
    const executiveSalesDataStart = moment.min(executiveComparisonStart, executiveMonthStart);
    const currentStart = now.clone().startOf('month');
    const previousStart = currentStart.clone().subtract(1, 'month');
    const previousEnd = previousStart.clone().endOf('month');
    const comparableDayCount = Math.min(now.date(), previousEnd.date());
    const previousComparableEnd = previousStart.clone().add(comparableDayCount - 1, 'days');
    const historyWithComparison = Array.from({ length: 13 }, (_, index) => monthReference(currentStart.clone().subtract(index, 'month')));
    const history = historyWithComparison.slice(0, 12);
    const reportYears = [...new Set(historyWithComparison.map((entry) => entry.year))];

    const companies = await this.prisma.company.findMany({
      where: { id: { in: companyIds }, isArchived: false, tenantId },
      select: { id: true, nameAr: true, nameEn: true },
    });

    const companyData = await Promise.all(
      companies.map(async (company) => {
        const [
          reports,
          currentPeriodAnalytics,
          previousPeriodAnalytics,
          executiveDailySales,
          executiveSalesChannels,
          currentCustomerDailyMetrics,
          previousCustomerDailyMetrics,
        ] = await Promise.all([
          Promise.all(
            reportYears.map(async (year) => ({
              year,
              report: await this.reportsService.getGeneralProfitLoss(company.id, year),
            })),
          ),
          this.reportsService.getGeneralProfitLossPeriodTotals(company.id, currentStart.format('YYYY-MM-DD'), now.format('YYYY-MM-DD')),
          this.reportsService.getGeneralProfitLossPeriodTotals(company.id, previousStart.format('YYYY-MM-DD'), previousComparableEnd.format('YYYY-MM-DD')),
          this.loadExecutiveDailySales(company.id, utcDateBoundary(executiveSalesDataStart), utcDateBoundary(latestCompleteDay, true)),
          this.loadExecutiveSalesChannels(company.id, utcDateBoundary(executiveMonthStart), utcDateBoundary(latestCompleteDay, true)),
          this.loadCustomerDailyMetrics(
            company.id,
            utcDateBoundary(currentStart),
            utcDateBoundary(now, true),
          ),
          this.loadCustomerDailyMetrics(
            company.id,
            utcDateBoundary(previousStart),
            utcDateBoundary(previousComparableEnd, true),
          ),
        ]);
        const reportByYear = new Map(reports.map((entry) => [entry.year, entry.report]));
        const currentRef = monthReference(now);
        const previousRef = monthReference(previousStart);
        const currentReport = reportByYear.get(currentRef.year);
        const previousReport = reportByYear.get(previousRef.year);
        if (!currentReport || !previousReport) throw new Error(`Missing report for company ${company.id}`);

        const currentValues = {
          sales: periodValue(currentPeriodAnalytics.sales, 'sales'),
          purchases: periodValue(currentPeriodAnalytics.purchases, 'purchases'),
          expenses: periodValue(currentPeriodAnalytics.expenses, 'expenses'),
        };
        const previousValues = {
          sales: periodValue(previousPeriodAnalytics.sales, 'sales'),
          purchases: periodValue(previousPeriodAnalytics.purchases, 'purchases'),
          expenses: periodValue(previousPeriodAnalytics.expenses, 'expenses'),
        };
        const previousComparableDailySalesAverage = new Decimal(previousValues.sales).div(comparableDayCount).toDecimalPlaces(2).toNumber();
        const currentCustomerDailyAverage = periodDailyAverage(
          currentCustomerDailyMetrics,
          selectedMonthAverageEndDay(currentCustomerDailyMetrics),
        ).customerAvgDaily;
        const previousCustomerDailyAverage = periodDailyAverage(
          previousCustomerDailyMetrics,
          comparableDayCount,
        ).customerAvgDaily;

        return {
          companyId: company.id,
          nameAr: company.nameAr,
          nameEn: company.nameEn,
          sales: metric(currentValues.sales, previousValues.sales),
          purchases: metric(currentValues.purchases, previousValues.purchases),
          expenses: metric(currentValues.expenses, previousValues.expenses),
          dailySalesAverage: {
            currentMonthToDate: new Decimal(currentValues.sales).div(now.date()).toDecimalPlaces(2).toNumber(),
            previousComparablePeriod: previousComparableDailySalesAverage,
            previousFullMonth: previousComparableDailySalesAverage,
          },
          customerDailyAverage: {
            currentMonthToDate: roundedAverage(currentCustomerDailyAverage),
            previousComparablePeriod: roundedAverage(previousCustomerDailyAverage),
          },
          executiveSnapshot: buildOwnerAdminDashboardExecutiveSnapshot({
            dailySales: executiveDailySales,
            latestCompleteDate: latestCompleteDay.format('YYYY-MM-DD'),
            salesChannels: executiveSalesChannels,
          }),
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
      }),
    );

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
        kind: 'month-to-date' as const,
        year: previousStart.year(),
        month: previousStart.month() + 1,
        startDate: previousStart.format('YYYY-MM-DD'),
        endDate: previousComparableEnd.format('YYYY-MM-DD'),
      },
      companies: companyData,
    };
  }
}

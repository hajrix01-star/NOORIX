import Decimal from 'decimal.js';
import type { GeneralProfitLossModel } from '../reports/reports-general-profit-loss-model.util';

export type OwnerOverviewMetric = 'sales' | 'purchases' | 'expenses' | 'netProfit';

export type OwnerOverviewCompany = {
  id: string;
  nameAr: string;
  nameEn: string | null;
};

export type OwnerOverviewDailySalesItem = {
  transactionDate?: string | Date | null;
  status?: string | null;
  totalAmount?: Decimal.Value | null;
};

export type OwnerOverviewCompanyReport = {
  company: OwnerOverviewCompany;
  report: GeneralProfitLossModel;
  dailySales: OwnerOverviewDailySalesItem[];
};

export type OwnerOverviewKpi = {
  key: OwnerOverviewMetric;
  total: number;
  percentOfSales: number | null;
  monthlyValues: number[];
};

export type OwnerOverviewCompanyRow = {
  companyId: string;
  nameAr: string;
  nameEn: string | null;
  sales: number;
  purchases: number;
  expenses: number;
  netProfit: number;
  purchasesToSalesPct: number | null;
  expensesToSalesPct: number | null;
  netProfitMarginPct: number | null;
};

export type OwnerOverviewMonthlyBucket = {
  month: number;
  sales: number;
  purchases: number;
  expenses: number;
  netProfit: number;
};

export type OwnerOverviewComparisonRow = {
  companyId: string;
  nameAr: string;
  nameEn: string | null;
  months: number[];
  total: number;
  shareOfGrandTotalPct: number | null;
  colorIndex: number;
};

export type OwnerOverviewComparison = {
  rows: OwnerOverviewComparisonRow[];
  grandMonthlyTotals: number[];
  grandTotal: number;
};

export type OwnerOverviewChartPoint = Record<string, string | number>;

export type OwnerOverviewExportRow = {
  companyId: string;
  companyNameAr: string;
  companyNameEn: string;
  sales: number;
  purchasesToSalesPct: number | null;
  expensesToSalesPct: number | null;
  netProfit: number;
};

export type OwnerOverviewModel = {
  schemaVersion: 1;
  period: {
    year: number;
    month: number | null;
  };
  companies: OwnerOverviewCompany[];
  kpis: OwnerOverviewKpi[];
  companyRows: OwnerOverviewCompanyRow[];
  monthlyBuckets: OwnerOverviewMonthlyBucket[];
  comparison: Record<OwnerOverviewMetric, OwnerOverviewComparison>;
  monthlyPerformance: Record<OwnerOverviewMetric, OwnerOverviewChartPoint[]>;
  dailyPerformance: OwnerOverviewChartPoint[];
  exportRows: OwnerOverviewExportRow[];
};

const OWNER_METRICS: OwnerOverviewMetric[] = ['sales', 'purchases', 'expenses', 'netProfit'];

function amount(value: unknown): number {
  if (value == null || value === '') return 0;
  const next = new Decimal(value as Decimal.Value);
  return next.isFinite() ? next.toNumber() : 0;
}

function percent(part: number, total: number): number | null {
  if (Math.abs(total) < 0.000001) return null;
  return new Decimal(part).div(total).mul(100).toDecimalPlaces(2).toNumber();
}

function monthlyValues(report: GeneralProfitLossModel, metric: OwnerOverviewMetric): number[] {
  if (metric === 'netProfit') {
    const row = report.summaryRows.find((entry) => entry.key === 'netProfit');
    return Array.from({ length: 12 }, (_, index) => amount(row?.months[index]));
  }

  const group = report.groups.find((entry) => entry.key === metric);
  return Array.from({ length: 12 }, (_, index) => amount(group?.months[index]));
}

function totalValue(report: GeneralProfitLossModel, metric: OwnerOverviewMetric, monthIndex: number | null): number {
  if (monthIndex != null) {
    return monthlyValues(report, metric)[monthIndex] ?? 0;
  }
  if (metric === 'netProfit') return amount(report.cards.netProfit);
  return amount(report.cards[metric]);
}

function dateKey(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function isDailySalesItem(value: unknown): value is OwnerOverviewDailySalesItem {
  return value != null && typeof value === 'object';
}

export function normalizeOwnerDailySalesItems(items: unknown[]): OwnerOverviewDailySalesItem[] {
  return items.filter(isDailySalesItem);
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function buildOwnerOverviewModel(input: {
  year: number;
  month: number | null;
  companies: OwnerOverviewCompanyReport[];
}): OwnerOverviewModel {
  const { year, month, companies } = input;
  const monthIndex = month != null ? month - 1 : null;

  const companyRows = companies.map<OwnerOverviewCompanyRow>((entry) => {
    const sales = totalValue(entry.report, 'sales', monthIndex);
    const purchases = totalValue(entry.report, 'purchases', monthIndex);
    const expenses = totalValue(entry.report, 'expenses', monthIndex);
    const netProfit = totalValue(entry.report, 'netProfit', monthIndex);
    return {
      companyId: entry.company.id,
      nameAr: entry.company.nameAr,
      nameEn: entry.company.nameEn,
      sales,
      purchases,
      expenses,
      netProfit,
      purchasesToSalesPct: percent(purchases, sales),
      expensesToSalesPct: percent(expenses, sales),
      netProfitMarginPct: percent(netProfit, sales),
    };
  });

  const monthlyBuckets = Array.from({ length: 12 }, (_, index) => {
    const bucket = { month: index + 1, sales: 0, purchases: 0, expenses: 0, netProfit: 0 };
    for (const entry of companies) {
      for (const metric of OWNER_METRICS) {
        bucket[metric] += monthlyValues(entry.report, metric)[index] ?? 0;
      }
    }
    return bucket;
  });

  const totals = OWNER_METRICS.reduce<Record<OwnerOverviewMetric, number>>((acc, metric) => {
    acc[metric] = companyRows.reduce((sum, row) => sum + row[metric], 0);
    return acc;
  }, { sales: 0, purchases: 0, expenses: 0, netProfit: 0 });

  const kpis = OWNER_METRICS.map<OwnerOverviewKpi>((metric) => ({
    key: metric,
    total: totals[metric],
    percentOfSales: metric === 'sales' ? null : percent(totals[metric], totals.sales),
    monthlyValues: monthlyBuckets.map((bucket) => bucket[metric]),
  }));

  const comparison = OWNER_METRICS.reduce<Record<OwnerOverviewMetric, OwnerOverviewComparison>>((acc, metric) => {
    const rows = companies.map<OwnerOverviewComparisonRow>((entry, colorIndex) => {
      const months = monthlyValues(entry.report, metric);
      const total = months.reduce((sum, value) => sum + value, 0);
      return {
        companyId: entry.company.id,
        nameAr: entry.company.nameAr,
        nameEn: entry.company.nameEn,
        months,
        total,
        shareOfGrandTotalPct: null,
        colorIndex,
      };
    });
    const grandMonthlyTotals = Array.from({ length: 12 }, (_, index) =>
      rows.reduce((sum, row) => sum + row.months[index], 0),
    );
    const grandTotal = rows.reduce((sum, row) => sum + row.total, 0);
    acc[metric] = {
      rows: rows.map((row) => ({
        ...row,
        shareOfGrandTotalPct: percent(row.total, grandTotal),
      })),
      grandMonthlyTotals,
      grandTotal,
    };
    return acc;
  }, {
    sales: { rows: [], grandMonthlyTotals: [], grandTotal: 0 },
    purchases: { rows: [], grandMonthlyTotals: [], grandTotal: 0 },
    expenses: { rows: [], grandMonthlyTotals: [], grandTotal: 0 },
    netProfit: { rows: [], grandMonthlyTotals: [], grandTotal: 0 },
  });

  const monthlyPerformance = OWNER_METRICS.reduce<Record<OwnerOverviewMetric, OwnerOverviewChartPoint[]>>((acc, metric) => {
    acc[metric] = Array.from({ length: 12 }, (_, index) => {
      const point: OwnerOverviewChartPoint = { label: String(index + 1) };
      for (const entry of companies) {
        point[entry.company.id] = monthlyValues(entry.report, metric)[index] ?? 0;
      }
      return point;
    });
    return acc;
  }, { sales: [], purchases: [], expenses: [], netProfit: [] });

  const dailyPerformance =
    month == null
      ? []
      : Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => {
          const day = index + 1;
          const key = `${year}-${pad(month)}-${pad(day)}`;
          const point: OwnerOverviewChartPoint = { label: String(day) };
          for (const entry of companies) {
            point[entry.company.id] = entry.dailySales
              .filter((item) => dateKey(item.transactionDate) === key && item.status !== 'cancelled')
              .reduce((sum, item) => sum + amount(item.totalAmount), 0);
          }
          return point;
        });

  return {
    schemaVersion: 1,
    period: { year, month },
    companies: companies.map((entry) => entry.company),
    kpis,
    companyRows,
    monthlyBuckets,
    comparison,
    monthlyPerformance,
    dailyPerformance,
    exportRows: [
      {
        companyId: 'total',
        companyNameAr: 'كل الشركات',
        companyNameEn: 'All companies',
        sales: totals.sales,
        purchasesToSalesPct: percent(totals.purchases, totals.sales),
        expensesToSalesPct: percent(totals.expenses, totals.sales),
        netProfit: totals.netProfit,
      },
      ...companyRows.map((row) => ({
        companyId: row.companyId,
        companyNameAr: row.nameAr,
        companyNameEn: row.nameEn ?? row.nameAr,
        sales: row.sales,
        purchasesToSalesPct: row.purchasesToSalesPct,
        expensesToSalesPct: row.expensesToSalesPct,
        netProfit: row.netProfit,
      })),
    ],
  };
}

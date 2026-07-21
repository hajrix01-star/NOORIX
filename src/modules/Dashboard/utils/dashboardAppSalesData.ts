import type { DashboardAppSalesMetricModel } from '../../../types/api/domains/dashboard';

export const DASHBOARD_APP_SALES_YEAR_SPAN_OPTIONS = [1, 2, 3] as const;
export type DashboardAppSalesYearSpan = (typeof DASHBOARD_APP_SALES_YEAR_SPAN_OPTIONS)[number];

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export type AppSalesMonthPoint = {
  year: number;
  month: number;
  periodKey: string;
  label: string;
  shortLabel: string;
  total: number;
  app: number;
  appPercent: number;
};

export type AppSalesChannelRow = {
  id: string;
  name: string;
  periodAmount: number;
  periodPercent: number;
  months: Record<string, { amount: number; percent: number }>;
};

export type DashboardAppSalesModel = {
  monthSeries: AppSalesMonthPoint[];
  channels: AppSalesChannelRow[];
  periodTotal: number;
  periodApp: number;
  periodAppPercent: number;
  hasData: boolean;
};

export type AppSalesTableFooterCell = {
  periodKey: string;
  appPercent: number;
  hasData: boolean;
};

export type AppSalesTableFooter = {
  monthCells: AppSalesTableFooterCell[];
  periodPercent: number;
  hasPeriodData: boolean;
};

export function parseDashboardAppSalesYearSpan(value: unknown): DashboardAppSalesYearSpan {
  const parsed = Number(value);
  return DASHBOARD_APP_SALES_YEAR_SPAN_OPTIONS.includes(parsed as DashboardAppSalesYearSpan)
    ? (parsed as DashboardAppSalesYearSpan)
    : 1;
}

export function buildDashboardAppSalesYearSpanOptions(t: (key: string) => string) {
  return DASHBOARD_APP_SALES_YEAR_SPAN_OPTIONS.map((span) => ({
    value: String(span),
    label: t(
      span === 1
        ? 'dashboardAppSalesYears1'
        : span === 2
          ? 'dashboardAppSalesYears2'
          : 'dashboardAppSalesYears3',
    ),
  }));
}

export function buildAppSalesTableFooter(model: DashboardAppSalesModel): AppSalesTableFooter {
  return {
    monthCells: model.monthSeries.map((p) => ({
      periodKey: p.periodKey,
      appPercent: p.appPercent,
      hasData: p.total > 0,
    })),
    periodPercent: model.periodAppPercent,
    hasPeriodData: model.periodTotal > 0,
  };
}

function monthLabel(year: number, month: number, lang: string): string {
  const index = month - 1;
  if (lang === 'ar') return `${MONTH_NAMES_AR[index] ?? month} ${year}`;
  return `${MONTH_NAMES_EN[index] ?? month} '${String(year).slice(-2)}`;
}

export function monthShortLabel(year: number, month: number, lang: string, yearsSpan: number): string {
  const index = month - 1;
  if (yearsSpan === 1) return lang === 'ar' ? String(month) : MONTH_NAMES_EN[index] ?? String(month);
  if (lang === 'ar') return `${month}/${String(year).slice(-2)}`;
  return `${MONTH_NAMES_EN[index] ?? month}'${String(year).slice(-2)}`;
}

export function buildDashboardAppSalesDisplayModelFromBackend(
  model: DashboardAppSalesMetricModel | null | undefined,
  lang: string,
  yearsSpan: number,
): DashboardAppSalesModel {
  const monthSeries = (model?.monthSeries ?? []).map((row) => ({
    ...row,
    label: monthLabel(row.year, row.month, lang),
    shortLabel: monthShortLabel(row.year, row.month, lang, yearsSpan),
  }));
  const channels = (model?.channels ?? []).map((row) => ({
    id: row.id,
    name: lang === 'en'
      ? row.nameEn?.trim() || row.nameAr?.trim() || row.id
      : row.nameAr?.trim() || row.nameEn?.trim() || row.id,
    periodAmount: row.periodAmount,
    periodPercent: row.periodPercent,
    months: row.months,
  }));
  return {
    monthSeries,
    channels,
    periodTotal: model?.periodTotal ?? 0,
    periodApp: model?.periodApp ?? 0,
    periodAppPercent: model?.periodAppPercent ?? 0,
    hasData: model?.hasData === true,
  };
}

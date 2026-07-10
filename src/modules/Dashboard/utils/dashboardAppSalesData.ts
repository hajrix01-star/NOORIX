/**
 * تجميع بيانات تبويب مبيعات التطبيقات — نسب شهرية + أداء كل قناة تطبيق.
 */
import { toYmd } from '../../../utils/saudiDate';

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

export type AppSalesMetricDay = {
  transactionDate?: string | null;
  totalAmount?: number | string | null;
};

export type AppSalesMetricChannel = {
  periodKey?: string | null;
  vaultId?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  type?: string | null;
  amount?: number | string | null;
};

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

/** صف المجموع — نسبة التطبيقات الكلية لكل شهر والفترة (ليس مجموع نسب القنوات) */
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
  const m = month - 1;
  if (lang === 'ar') return `${MONTH_NAMES_AR[m]} ${year}`;
  return `${MONTH_NAMES_EN[m]} '${String(year).slice(-2)}`;
}

/** تسمية مختصرة لمحور الرسم — تقلّل التداخل على الجوال */
export function monthShortLabel(year: number, month: number, lang: string, yearsSpan: number): string {
  const m = month - 1;
  if (yearsSpan === 1) {
    return lang === 'ar' ? String(month) : MONTH_NAMES_EN[m];
  }
  if (lang === 'ar') return `${month}/${String(year).slice(-2)}`;
  return `${MONTH_NAMES_EN[m]}'${String(year).slice(-2)}`;
}

/** يولّد كل أشهر النطاق (حتى الفارغة) لعرض متصل على الرسم */
export function listMonthKeys(yearEnd: number, yearsSpan: number): { year: number; month: number; periodKey: string }[] {
  const yearStart = yearEnd - yearsSpan + 1;
  const out: { year: number; month: number; periodKey: string }[] = [];
  for (let y = yearStart; y <= yearEnd; y += 1) {
    for (let m = 1; m <= 12; m += 1) {
      out.push({ year: y, month: m, periodKey: `${y}-${String(m).padStart(2, '0')}` });
    }
  }
  return out;
}

export function buildDashboardAppSalesModelFromMetrics(
  dailyRows: AppSalesMetricDay[] | null | undefined,
  channelRowsInput: AppSalesMetricChannel[] | null | undefined,
  lang: string,
  yearEnd: number,
  yearsSpan: number,
): DashboardAppSalesModel {
  const yearStart = yearEnd - yearsSpan + 1;
  const monthKeys = listMonthKeys(yearEnd, yearsSpan);
  const totals: Record<string, number> = {};
  const apps: Record<string, number> = {};
  const channelRows: Record<string, { name: string; amounts: Record<string, number> }> = {};

  monthKeys.forEach(({ periodKey }) => {
    totals[periodKey] = 0;
    apps[periodKey] = 0;
  });

  for (const row of dailyRows ?? []) {
    const d = toYmd(row.transactionDate);
    if (!d || d.length < 7) continue;
    const y = parseInt(d.slice(0, 4), 10);
    const m = parseInt(d.slice(5, 7), 10);
    if (y < yearStart || y > yearEnd || m < 1 || m > 12) continue;
    const periodKey = `${y}-${String(m).padStart(2, '0')}`;
    totals[periodKey] = (totals[periodKey] || 0) + Number(row.totalAmount || 0);
  }

  for (const row of channelRowsInput ?? []) {
    const periodKey = row.periodKey ?? '';
    if (!Object.prototype.hasOwnProperty.call(totals, periodKey)) continue;
    const amount = Number(row.amount || 0);
    if (!Number.isFinite(amount) || amount === 0 || row.type !== 'app') continue;
    const id = row.vaultId?.trim() || `${row.nameAr ?? ''}|${row.nameEn ?? ''}`;
    const name = lang === 'en'
      ? row.nameEn?.trim() || row.nameAr?.trim() || id
      : row.nameAr?.trim() || row.nameEn?.trim() || id;
    apps[periodKey] = (apps[periodKey] || 0) + amount;
    if (!channelRows[id]) channelRows[id] = { name, amounts: {} };
    channelRows[id].amounts[periodKey] = (channelRows[id].amounts[periodKey] || 0) + amount;
  }

  const monthSeries: AppSalesMonthPoint[] = monthKeys.map(({ year, month, periodKey }) => {
    const total = totals[periodKey] || 0;
    const app = apps[periodKey] || 0;
    return {
      year,
      month,
      periodKey,
      label: monthLabel(year, month, lang),
      shortLabel: monthShortLabel(year, month, lang, yearsSpan),
      total,
      app,
      appPercent: total > 0 ? (app / total) * 100 : 0,
    };
  });

  const periodTotal = monthSeries.reduce((s, p) => s + p.total, 0);
  const periodApp = monthSeries.reduce((s, p) => s + p.app, 0);
  const periodAppPercent = periodTotal > 0 ? (periodApp / periodTotal) * 100 : 0;

  const channels: AppSalesChannelRow[] = Object.entries(channelRows)
    .map(([id, row]) => {
      const months: Record<string, { amount: number; percent: number }> = {};
      let periodAmount = 0;
      monthKeys.forEach(({ periodKey }) => {
        const amount = row.amounts[periodKey] || 0;
        const monthTotal = totals[periodKey] || 0;
        months[periodKey] = {
          amount,
          percent: monthTotal > 0 ? (amount / monthTotal) * 100 : 0,
        };
        periodAmount += amount;
      });
      return {
        id,
        name: row.name,
        periodAmount,
        periodPercent: periodTotal > 0 ? (periodAmount / periodTotal) * 100 : 0,
        months,
      };
    })
    .filter((c) => c.periodAmount > 0)
    .sort((a, b) => b.periodAmount - a.periodAmount);

  return {
    monthSeries,
    channels,
    periodTotal,
    periodApp,
    periodAppPercent,
    hasData: periodTotal > 0,
  };
}

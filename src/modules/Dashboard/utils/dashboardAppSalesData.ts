/**
 * تجميع بيانات تبويب مبيعات التطبيقات — نسب شهرية + أداء كل قناة تطبيق.
 */
import { toYmd } from '../../../utils/saudiDate';

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const MONTH_NAMES_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export type AppSalesSummaryChannel = {
  amount?: number | string | null;
  vault?: { type?: string | null; nameAr?: string | null; nameEn?: string | null } | null;
};

export type AppSalesSummaryRow = {
  transactionDate?: string | Date | null;
  totalAmount?: number | string | null;
  channels?: AppSalesSummaryChannel[] | null;
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

function channelName(ch: AppSalesSummaryChannel, lang: string): string | null {
  const v = ch.vault;
  if (!v) return null;
  const ar = v.nameAr?.trim();
  const en = v.nameEn?.trim();
  if (lang === 'en') return en || ar || null;
  return ar || en || null;
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

export function buildDashboardAppSalesModel(
  summaries: AppSalesSummaryRow[],
  lang: string,
  yearEnd: number,
  yearsSpan: number,
): DashboardAppSalesModel {
  const yearStart = yearEnd - yearsSpan + 1;
  const monthKeys = listMonthKeys(yearEnd, yearsSpan);

  const totals: Record<string, number> = {};
  const apps: Record<string, number> = {};
  const channelAmounts: Record<string, Record<string, number>> = {};

  monthKeys.forEach(({ periodKey }) => {
    totals[periodKey] = 0;
    apps[periodKey] = 0;
  });

  (summaries || []).forEach((s) => {
    const d = toYmd(s.transactionDate);
    if (!d || d.length < 7) return;
    const y = parseInt(d.slice(0, 4), 10);
    const m = parseInt(d.slice(5, 7), 10);
    if (y < yearStart || y > yearEnd || m < 1 || m > 12) return;

    const periodKey = `${y}-${String(m).padStart(2, '0')}`;
    const total = Number(s.totalAmount || 0);
    totals[periodKey] = (totals[periodKey] || 0) + total;

    (s.channels || []).forEach((ch) => {
      const amt = Number(ch.amount || 0);
      if (!Number.isFinite(amt) || amt === 0) return;
      const isApp = ch.vault?.type === 'app';
      if (isApp) apps[periodKey] = (apps[periodKey] || 0) + amt;

      if (!isApp) return;
      const name = channelName(ch, lang);
      if (!name) return;
      if (!channelAmounts[name]) channelAmounts[name] = {};
      channelAmounts[name][periodKey] = (channelAmounts[name][periodKey] || 0) + amt;
    });
  });

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

  const channels: AppSalesChannelRow[] = Object.entries(channelAmounts)
    .map(([name, byMonth]) => {
      const months: Record<string, { amount: number; percent: number }> = {};
      let periodAmount = 0;
      monthKeys.forEach(({ periodKey }) => {
        const amount = byMonth[periodKey] || 0;
        const monthTotal = totals[periodKey] || 0;
        months[periodKey] = {
          amount,
          percent: monthTotal > 0 ? (amount / monthTotal) * 100 : 0,
        };
        periodAmount += amount;
      });
      return {
        id: name,
        name,
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

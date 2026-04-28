import { toYmd } from '../../../../utils/saudiDate';
import type { PlReportLike } from './dashboardOverviewCalculations';

type TFn = (key: string) => string;

type SummaryLike = {
  transactionDate?: string | null;
  totalAmount?: string | number | null;
  channels?: Array<{ amount?: string | number | null; vault?: { nameAr?: string | null; nameEn?: string | null } }>;
};

export function buildPerformanceRows(params: {
  report: PlReportLike | null | undefined;
  timelineGrain: string;
  dailySummaries: SummaryLike[];
  lastDayChart: number;
  lang: string;
  t: TFn;
  monthNamesAr: string[];
  enMonths: readonly string[];
}): Record<string, string | number>[] {
  const {
    report,
    timelineGrain,
    dailySummaries,
    lastDayChart,
    lang,
    t,
    monthNamesAr,
    enMonths,
  } = params;

  if (timelineGrain === 'daily') {
    const byDay = new Map<number, number>();
    (dailySummaries || []).forEach((s) => {
      const d = toYmd(s.transactionDate);
      const dayNum = parseInt(d.slice(8, 10), 10);
      byDay.set(dayNum, (byDay.get(dayNum) || 0) + Number(s.totalAmount || 0));
    });
    return Array.from({ length: lastDayChart }, (_, i) => ({
      label: String(i + 1),
      [t('annualSales')]: byDay.get(i + 1) || 0,
    }));
  }

  const sg = report?.groups?.find((r) => r.key === 'sales');
  const pg = report?.groups?.find((r) => r.key === 'purchases');
  const eg = report?.groups?.find((r) => r.key === 'expenses');
  return enMonths.map((lbl, i) => ({
    label: lang === 'ar' ? monthNamesAr[i] : lbl,
    [t('annualSales')]: Number(sg?.months?.[i] || 0),
    [t('annualPurchases')]: Number(pg?.months?.[i] || 0),
    [t('annualExpenses')]: Number(eg?.months?.[i] || 0),
  }));
}

export function buildChannelPieRows(params: {
  yearSummaries: SummaryLike[];
  dailySummaries: SummaryLike[];
  timelineGrain: string;
  lang: string;
}): { name: string; value: number; pct: string }[] {
  const { yearSummaries, dailySummaries, timelineGrain, lang } = params;
  const src = timelineGrain === 'daily' ? dailySummaries || [] : yearSummaries || [];
  const map: Record<string, number> = {};
  src.forEach((s) =>
    (s.channels || []).forEach((ch) => {
      const name =
        lang === 'ar'
          ? ch.vault?.nameAr || ch.vault?.nameEn || '—'
          : ch.vault?.nameEn || ch.vault?.nameAr || '—';
      map[name] = (map[name] || 0) + Number(ch.amount || 0);
    }),
  );
  const total = Object.values(map).reduce((s, v) => s + v, 0) || 1;
  return Object.entries(map)
    .map(([name, value]) => ({ name, value, pct: ((value / total) * 100).toFixed(1) }))
    .sort((a, b) => b.value - a.value);
}

export function buildTopSuppliersChartData(
  periodData: { topSuppliers?: Array<Record<string, unknown>> } | null | undefined,
  lang: string,
  pieColors: readonly string[],
): Array<{
  name: string;
  value: number;
  count: number;
  pct: string;
  fill: string;
}> {
  const list = (periodData?.topSuppliers || []).slice(0, 8);
  const total = list.reduce((s, x) => s + Number((x as { totalAmount?: unknown }).totalAmount || 0), 0) || 1;
  return list.map((s, i) => {
    const row = s as {
      nameAr?: string;
      nameEn?: string;
      totalAmount?: unknown;
      invoiceCount?: number;
    };
    return {
      name: (lang === 'ar' ? row.nameAr || row.nameEn : row.nameEn || row.nameAr) || '—',
      value: Number(row.totalAmount || 0),
      count: row.invoiceCount || 0,
      pct: ((Number(row.totalAmount || 0) / total) * 100).toFixed(1),
      fill: pieColors[i % pieColors.length],
    };
  });
}

export function buildPurchaseCategoriesData(
  periodData: {
    purchaseCategoryBreakdown?: Array<Record<string, unknown>>;
    purchaseCategoryTotal?: unknown;
  } | null | undefined,
  lang: string,
  pieColors: readonly string[],
): { name: string; value: number; pct: string; fill: string }[] {
  const raw = periodData?.purchaseCategoryBreakdown;
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const total =
    Number(periodData?.purchaseCategoryTotal) ||
    raw.reduce((s, r) => s + Number((r as { amount?: unknown }).amount || 0), 0) ||
    1;
  return raw.map((row, i) => {
    const r = row as { amount?: unknown; nameAr?: string; nameEn?: string };
    const amt = Number(r.amount || 0);
    return {
      name: lang === 'ar' ? String(r.nameAr) : String(r.nameEn || r.nameAr) || '—',
      value: amt,
      pct: ((amt / total) * 100).toFixed(1),
      fill: pieColors[i % pieColors.length],
    };
  });
}

export function mergePurchaseCategoriesOthers(
  purchaseCategoriesData: { name: string; value: number; pct: string; fill: string }[],
  othersLabel: string,
  pieColors: readonly string[],
): { name: string; value: number; pct: string; fill: string }[] {
  if (purchaseCategoriesData.length === 0) return [];
  if (purchaseCategoriesData.length <= 6) return purchaseCategoriesData;
  const top = purchaseCategoriesData.slice(0, 5);
  const rest = purchaseCategoriesData.slice(5);
  const othersValue = rest.reduce((s, r) => s + r.value, 0);
  const total = purchaseCategoriesData.reduce((s, r) => s + r.value, 0) || 1;
  return [
    ...top,
    {
      name: othersLabel,
      value: othersValue,
      pct: ((othersValue / total) * 100).toFixed(1),
      fill: pieColors[5 % pieColors.length],
    },
  ];
}

export function computeRevenueDailyAvgActiveDays(
  monthSalesForDailyAvg: SummaryLike[] | null | undefined,
): number | null {
  if (!monthSalesForDailyAvg?.length) return null;
  const byDay = new Map<string, number>();
  monthSalesForDailyAvg.forEach((s) => {
    const d = toYmd(s.transactionDate);
    byDay.set(d, (byDay.get(d) || 0) + Number(s.totalAmount || 0));
  });
  let sum = 0;
  let n = 0;
  for (const amt of byDay.values()) {
    if (amt > 0) {
      sum += amt;
      n += 1;
    }
  }
  if (n === 0) return null;
  return sum / n;
}

export function performanceTotalForSalesKey(
  performanceData: Record<string, string | number>[],
  salesKey: string,
): number {
  return performanceData.reduce((s, p) => s + Number(p[salesKey] || 0), 0);
}

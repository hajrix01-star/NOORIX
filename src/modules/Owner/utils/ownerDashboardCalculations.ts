import { toYmd } from '../../../utils/saudiDate';
import { EN_MONTHS } from '../../Reports/reportHelpers';
import type {
  OwnerChartPoint,
  OwnerCompanySeries,
  OwnerDailySalesItem,
  OwnerDashboardMetric,
  OwnerKpiTotals,
  OwnerMonthlyBucket,
  OwnerMonthlyComparisonRow,
  OwnerPlReport,
} from '../types';
import type { CompanyListItem } from '../../../context/appTypes';

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

export { MONTH_NAMES_AR };

export function asOwnerReport(r: unknown): OwnerPlReport | undefined {
  if (r && typeof r === 'object') return r as OwnerPlReport;
  return undefined;
}

/** يُعيد مصفوفة 12 قيمة شهرية لمؤشر معين من تقرير شركة */
export function getCompanyMonthlyArr(report: OwnerPlReport | undefined, metric: OwnerDashboardMetric) {
  if (!report) return Array(12).fill(0);
  if (metric === 'netProfit') {
    const row = report.summaryRows?.find((x) => x.key === 'netProfit');
    return Array.from({ length: 12 }, (_, i) => Number(row?.months?.[i] || 0));
  }
  const group = report.groups?.find((x) => x.key === metric);
  return Array.from({ length: 12 }, (_, i) => Number(group?.months?.[i] || 0));
}

export function getMonthValue(
  report: unknown,
  key: OwnerDashboardMetric,
  monthIdx: number | null,
): number {
  const r = asOwnerReport(report);
  if (!r) return 0;
  if (monthIdx == null) {
    if (key === 'sales' || key === 'purchases' || key === 'expenses') return Number(r.cards?.[key] || 0);
    if (key === 'netProfit') return Number(r.cards?.netProfit || 0);
    return 0;
  }
  if (key === 'netProfit') {
    const row = r.summaryRows?.find((row) => row.key === 'netProfit');
    return Number(row?.months?.[monthIdx] || 0);
  }
  const group = r.groups?.find((g) => g.key === key);
  return Number(group?.months?.[monthIdx] || 0);
}

export function buildAggregated(
  reportsByCompany: Record<string, unknown>,
  companyList: CompanyListItem[],
  lang: string,
  selectedMonthNum: number | null,
): OwnerKpiTotals {
  const m = selectedMonthNum != null ? selectedMonthNum - 1 : null;
  let totalSales = 0;
  let totalPurchases = 0;
  let totalExpenses = 0;
  let totalNetProfit = 0;
  const byCompany: OwnerKpiTotals['byCompany'] = [];
  Object.entries(reportsByCompany).forEach(([companyId, raw]) => {
    const sales = getMonthValue(raw, 'sales', m);
    const purchases = getMonthValue(raw, 'purchases', m);
    const expenses = getMonthValue(raw, 'expenses', m);
    const netProfit = getMonthValue(raw, 'netProfit', m);
    totalSales += sales;
    totalPurchases += purchases;
    totalExpenses += expenses;
    totalNetProfit += netProfit;
    const company = companyList.find((c) => c.id === companyId);
    const name =
      lang === 'ar'
        ? company?.nameAr || company?.nameEn || companyId
        : company?.nameEn || company?.nameAr || companyId;
    byCompany.push({ companyId, name, sales, purchases, expenses, netProfit });
  });
  return { totalSales, totalPurchases, totalExpenses, totalNetProfit, byCompany };
}

export function buildAggregatedMonthly(
  reportsByCompany: Record<string, unknown>,
): OwnerMonthlyBucket[] {
  const months: OwnerMonthlyBucket[] = Array.from({ length: 12 }, () => ({
    sales: 0,
    purchases: 0,
    expenses: 0,
    netProfit: 0,
  }));
  Object.values(reportsByCompany).forEach((raw) => {
    const report = asOwnerReport(raw);
    const salesG = report?.groups?.find((r) => r.key === 'sales');
    const purchG = report?.groups?.find((r) => r.key === 'purchases');
    const expG = report?.groups?.find((r) => r.key === 'expenses');
    const netRow = report?.summaryRows?.find((r) => r.key === 'netProfit');
    for (let i = 0; i < 12; i++) {
      months[i].sales += Number(salesG?.months?.[i] || 0);
      months[i].purchases += Number(purchG?.months?.[i] || 0);
      months[i].expenses += Number(expG?.months?.[i] || 0);
      months[i].netProfit += Number(netRow?.months?.[i] || 0);
    }
  });
  return months;
}

export function buildCompanyMonthlyData(
  idsToFetch: string[],
  reportsByCompany: Record<string, unknown>,
  companyList: CompanyListItem[],
  lang: string,
  comparisonMetric: OwnerDashboardMetric,
  colors: readonly string[],
): OwnerMonthlyComparisonRow[] {
  return idsToFetch.map((cid, i) => {
    const report = asOwnerReport(reportsByCompany[cid]);
    const company = companyList.find((c) => c.id === cid);
    const name =
      lang === 'ar'
        ? company?.nameAr || company?.nameEn || cid
        : company?.nameEn || company?.nameAr || cid;
    const months = getCompanyMonthlyArr(report, comparisonMetric);
    const total = months.reduce((a, b) => a + b, 0);
    return { cid, name, months, total, color: colors[i % colors.length] };
  });
}

export function buildGrandMonthlyTotals(companyMonthlyData: OwnerMonthlyComparisonRow[]): number[] {
  return Array.from({ length: 12 }, (_, i) =>
    companyMonthlyData.reduce((a, c) => a + (c.months[i] || 0), 0),
  );
}

export function buildPerformanceData(params: {
  chartGrain: string;
  year: number;
  chartMonthForDaily: number;
  idsToFetch: string[];
  reportsByCompany: Record<string, unknown>;
  metricFilter: Set<string>;
  lang: string;
  itemsByCompanyId: Record<string, OwnerDailySalesItem[]>;
}): OwnerChartPoint[] {
  const {
    chartGrain,
    year,
    chartMonthForDaily,
    idsToFetch,
    reportsByCompany,
    metricFilter,
    lang,
    itemsByCompanyId,
  } = params;

  if (chartGrain === 'daily') {
    const lastDay = new Date(year, chartMonthForDaily, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    return Array.from({ length: lastDay }, (_, idx) => {
      const day = idx + 1;
      const dateStr = `${year}-${pad(chartMonthForDaily)}-${pad(day)}`;
      const entry: OwnerChartPoint = { label: String(day) };
      idsToFetch.forEach((cid) => {
        const list = itemsByCompanyId[cid] || [];
        entry[cid] = list
          .filter((s) => toYmd(s.transactionDate) === dateStr && s.status !== 'cancelled')
          .reduce((a, s) => a + Number(s.totalAmount || 0), 0);
      });
      return entry;
    });
  }

  const activeMetrics = (['sales', 'purchases', 'expenses'] as const).filter((k) => metricFilter.has(k));
  return Array.from({ length: 12 }, (_, i) => {
    const entry: OwnerChartPoint = {
      label: lang === 'ar' ? MONTH_NAMES_AR[i] : EN_MONTHS[i],
    };
    idsToFetch.forEach((cid) => {
      const report = asOwnerReport(reportsByCompany[cid]);
      entry[cid] = activeMetrics.reduce((sum, key) => {
        const g = report?.groups?.find((r) => r.key === key);
        return sum + Number(g?.months?.[i] || 0);
      }, 0);
    });
    return entry;
  });
}

export function buildCompanySeries(
  idsToFetch: string[],
  companyList: CompanyListItem[],
  lang: string,
  colors: readonly string[],
): OwnerCompanySeries[] {
  return idsToFetch.map((cid, i) => {
    const c = companyList.find((x) => x.id === cid);
    return {
      key: cid,
      label: lang === 'ar' ? c?.nameAr || c?.nameEn || cid : c?.nameEn || c?.nameAr || cid,
      color: colors[i % colors.length],
      gradId: `grad-owner-${i}`,
    };
  });
}

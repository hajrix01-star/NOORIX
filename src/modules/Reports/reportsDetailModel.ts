import { dailyAverage } from '../../shared/reporting/plDisplaySelectors';
import { isEmptyMetric } from './reportHelpers';

export const DETAIL_INVOICES_PAGE_SIZE = 15;

export type TranslateFn = (key: string, vars?: Record<string, unknown> | string) => string;

export type ReportsDetailState = {
  month?: number | null;
  groupKey?: string | null;
  itemKey?: string | null;
  showTrend?: boolean;
};

export type TrendPoint = {
  month: number;
  label: string;
  amount?: string | number | null;
  percentOfSales?: string | number | null;
};

export type TrendChartRow = {
  key: string;
  name: string;
  amount: number;
  rawAmount: number;
  pctStr: string;
  isSelected: boolean;
};

export type ReportDetailItem = {
  key?: string;
  id?: string;
  labelAr?: string | null;
  labelEn?: string | null;
  amount?: string | number | null;
  transactionDate?: string | Date | null;
  summaryNumber?: string | null;
  invoiceNumber?: string | null;
  supplierNameAr?: string | null;
  supplierNameEn?: string | null;
  itemLabelAr?: string | null;
  itemLabelEn?: string | null;
  totalAmount?: string | number | null;
  netAmount?: string | number | null;
  taxAmount?: string | number | null;
  notes?: string | null;
  percentOfSales?: string | number | null;
  percentOfTotal?: string | number | null;
  channelNames?: Array<{ nameAr?: string | null; nameEn?: string | null }>;
};

export type ReportsDetailData = {
  kind: 'invoices' | 'derived';
  titleAr?: string;
  titleEn?: string;
  month?: number | null;
  monthLabel?: string | null;
  contextAmount?: string | number | null;
  annualAmount?: string | number | null;
  contextPercentOfSales?: string | number | null;
  invoiceCount?: string | number | null;
  items?: ReportDetailItem[];
};

export type ReportTrendData = {
  points?: TrendPoint[];
  total?: string | number | null;
  percentOfSalesYear?: string | number | null;
};

export type ReportDetailCompanyRef = {
  id?: string;
  nameAr?: string | null;
  nameEn?: string | null;
  logoUrl?: string | null;
};

export type TooltipPayload = { payload?: TrendChartRow };
export type TooltipProps = { active?: boolean; payload?: readonly TooltipPayload[] };

export type ReportsDetailTabId = 'summary' | 'trend' | 'documents' | 'breakdown';

export type ReportsDetailTabItem = {
  id: ReportsDetailTabId;
  label: string;
};

export function isReportsDetailTabId(value: string): value is ReportsDetailTabId {
  return value === 'summary' || value === 'trend' || value === 'documents' || value === 'breakdown';
}

export function buildReportsDetailTabs(
  t: TranslateFn,
  state: ReportsDetailState | null,
  data: ReportsDetailData | undefined,
): ReportsDetailTabItem[] {
  const out: ReportsDetailTabItem[] = [{ id: 'summary', label: t('reportTabSummary') }];
  if (state?.showTrend) out.push({ id: 'trend', label: t('reportTabTrend') });
  if (data?.kind === 'invoices') out.push({ id: 'documents', label: t('reportTabDocuments') });
  if (data?.kind === 'derived') out.push({ id: 'breakdown', label: t('reportTabBreakdown') });
  return out;
}

export function buildTrendChartRows(
  trend: ReportTrendData | undefined,
  selectedMonth: number | null | undefined,
  percentText: (value: unknown) => string,
): TrendChartRow[] {
  return (trend?.points ?? []).map((point) => {
    const raw = Number(point.amount || 0);
    return {
      key: String(point.month),
      name: point.label,
      amount: Math.abs(raw),
      rawAmount: raw,
      pctStr: percentText(point.percentOfSales),
      isSelected: selectedMonth === point.month,
    };
  });
}

export function findPeakTrendPoint(trend: ReportTrendData | undefined): TrendPoint | null {
  const points = trend?.points ?? [];
  if (!points.length) return null;
  return points.reduce((best, point) => (Number(point.amount || 0) > Number(best.amount || 0) ? point : best), points[0]);
}

export function findSelectedTrendPoint(
  trend: ReportTrendData | undefined,
  selectedMonth: number | null | undefined,
): TrendPoint | null {
  if (selectedMonth == null) return null;
  return trend?.points?.find((point) => point.month === selectedMonth) ?? null;
}

export function resolveDisplayContextAmount(
  data: ReportsDetailData | undefined,
  selectedTrendPoint: TrendPoint | null,
): string | number | null | undefined {
  if (!data) return null;
  if (!isEmptyMetric(data.contextAmount)) return data.contextAmount;
  if (selectedTrendPoint != null && !isEmptyMetric(selectedTrendPoint.amount)) return String(selectedTrendPoint.amount);
  return data.contextAmount;
}

export function resolveDisplayAnnualAmount(
  data: ReportsDetailData | undefined,
  trend: ReportTrendData | undefined,
): string | number | null | undefined {
  if (!data) return null;
  if (!isEmptyMetric(data.annualAmount)) return data.annualAmount;
  if (trend != null && !isEmptyMetric(trend.total)) return String(trend.total);
  return data.annualAmount;
}

export function resolveDisplayContextPercent(
  data: ReportsDetailData | undefined,
  selectedTrendPoint: TrendPoint | null,
): string | number | null | undefined {
  if (!data) return null;
  if (!isEmptyMetric(data.contextPercentOfSales)) return data.contextPercentOfSales;
  if (selectedTrendPoint != null && !isEmptyMetric(selectedTrendPoint.percentOfSales)) {
    return String(selectedTrendPoint.percentOfSales);
  }
  return data.contextPercentOfSales;
}

export function computeMonthlyAverageAmount(trend: ReportTrendData | undefined): string {
  const points = trend?.points ?? [];
  if (!points.length) return '0';
  const withData = points.filter((point) => !isEmptyMetric(point.amount));
  const slice = withData.length ? withData : points;
  const total = slice.reduce((sum, point) => sum + Number(point.amount || 0), 0);
  return String(dailyAverage(total, slice.length) ?? 0);
}

export function reportDetailSourceName(item: ReportDetailItem, lang: string): string {
  return (
    (lang === 'en' ? item.supplierNameEn : item.supplierNameAr) ||
    item.supplierNameAr ||
    item.supplierNameEn ||
    (lang === 'en' ? item.itemLabelEn : item.itemLabelAr) ||
    '—'
  );
}

export function reportDetailItemLabel(item: ReportDetailItem, lang: string): string {
  return (lang === 'en' ? item.labelEn : item.labelAr) || item.labelAr || item.labelEn || '—';
}

export function reportDetailChannelNames(item: ReportDetailItem, lang: string): string {
  return (item.channelNames ?? [])
    .slice(0, 2)
    .map((channel) => (lang === 'en' ? (channel.nameEn || channel.nameAr) : (channel.nameAr || channel.nameEn)))
    .filter(Boolean)
    .join(' | ');
}

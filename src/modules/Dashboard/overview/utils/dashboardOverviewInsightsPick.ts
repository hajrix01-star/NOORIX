import type { DashboardInsightsPayload } from '../../../../services/reportingInsightsApi';
import type {
  DashboardInsightDisplayItem,
  DashboardInsightMetricBasis,
  DashboardInsightSeverity,
} from '../types/dashboardInsightsDisplay';

const MAX_ITEMS = 5;

const ALLOWED_BASIS = new Set<DashboardInsightMetricBasis>([
  'accounting_pl',
  'operational_sales',
  'invoice_period',
]);

function isSeverity(v: unknown): v is DashboardInsightSeverity {
  return v === 'info' || v === 'warning' || v === 'critical';
}

function isBasis(v: unknown): v is DashboardInsightMetricBasis {
  return v === 'accounting_pl' || v === 'operational_sales' || v === 'invoice_period';
}

/** يستخرج عنصر عرض من عنصر API خام — يُرجع null إن لم يمر بالمرشحات */
export function parseInsightDisplayItem(raw: unknown): DashboardInsightDisplayItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  if (!id) return null;
  if (!isSeverity(o.severity) || !isBasis(o.metricBasis)) return null;
  return {
    id,
    severity: o.severity,
    metricBasis: o.metricBasis,
    titleAr: typeof o.titleAr === 'string' ? o.titleAr : '',
    titleEn: typeof o.titleEn === 'string' ? o.titleEn : '',
    detailAr: typeof o.detailAr === 'string' ? o.detailAr : '',
    detailEn: typeof o.detailEn === 'string' ? o.detailEn : '',
  };
}

/**
 * تحذيرات أولاً ثم رؤى، حتى ‎MAX_ITEMS — يُقبل فقط الأساسات المسموحة في v1.
 */
export function pickDashboardInsightDisplayItems(
  payload: DashboardInsightsPayload | undefined | null,
): DashboardInsightDisplayItem[] {
  if (!payload) return [];
  const warnings = (payload.warnings ?? [])
    .map(parseInsightDisplayItem)
    .filter((x): x is DashboardInsightDisplayItem => x != null && ALLOWED_BASIS.has(x.metricBasis));
  const insights = (payload.insights ?? [])
    .map(parseInsightDisplayItem)
    .filter((x): x is DashboardInsightDisplayItem => x != null && ALLOWED_BASIS.has(x.metricBasis));
  const merged = [...warnings, ...insights];
  return merged.slice(0, MAX_ITEMS);
}

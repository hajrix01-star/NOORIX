/**
 * Reporting insights — قراءة فقط من ‎GET /api/v1/reporting/insights/dashboard
 */
import type { ApiParsedResult } from '../types/api';
import { apiGet } from './core/apiHttp';
import { toYmd } from '../utils/saudiDate';

/** يقترب من ‎backend/src/reporting/insights/insights.types.ts — وسّع عند ربط الواجهة */
export type DashboardInsightsPayload = {
  schemaVersion: number;
  generatedAt: string;
  context: {
    companyId: string;
    year: number;
    selectedMonth: number | null;
    labels: Record<string, string>;
  };
  metrics: unknown;
  ratios: unknown;
  health: unknown;
  insights: unknown[];
  opportunities: unknown[];
  warnings: unknown[];
};

export type GetDashboardInsightsParams = {
  companyId: string;
  year: number;
  yearStart: string;
  yearEnd: string;
  dailyStart?: string | null;
  dailyEnd?: string | null;
  monthStart?: string | null;
  monthEnd?: string | null;
  periodStart: string;
  periodEnd: string;
  selectedMonth?: number | null;
  includeCancelledSales?: boolean;
};

export async function getDashboardInsights(
  params: GetDashboardInsightsParams,
): Promise<ApiParsedResult<DashboardInsightsPayload>> {
  const q: Record<string, string | number | boolean | undefined> = {
    companyId: String(params.companyId),
    year: params.year,
    yearStart: toYmd(params.yearStart),
    yearEnd: toYmd(params.yearEnd),
    periodStart: toYmd(params.periodStart),
    periodEnd: toYmd(params.periodEnd),
  };
  const ds = params.dailyStart != null && params.dailyStart !== '' ? toYmd(params.dailyStart) : '';
  const de = params.dailyEnd != null && params.dailyEnd !== '' ? toYmd(params.dailyEnd) : '';
  const ms = params.monthStart != null && params.monthStart !== '' ? toYmd(params.monthStart) : '';
  const me = params.monthEnd != null && params.monthEnd !== '' ? toYmd(params.monthEnd) : '';
  if (ds) q.dailyStart = ds;
  if (de) q.dailyEnd = de;
  if (ms) q.monthStart = ms;
  if (me) q.monthEnd = me;
  if (params.selectedMonth != null && params.selectedMonth >= 1 && params.selectedMonth <= 12) {
    q.selectedMonth = params.selectedMonth;
  }
  if (params.includeCancelledSales === true) q.includeCancelledSales = true;

  return apiGet('/api/v1/reporting/insights/dashboard', q);
}

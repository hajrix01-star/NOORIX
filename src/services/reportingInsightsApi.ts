/**
 * Reporting insights — قراءة فقط من ‎GET /api/v1/reporting/insights/dashboard
 */
import type { ApiParsedResult } from '../types/api';
import { apiGet } from './core/apiHttp';
import {
  buildDashboardPeriodQuery,
  type DashboardPeriodApiParams,
} from './domains/apiEndpoints/dashboard-period-query';

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

export type GetDashboardInsightsParams = DashboardPeriodApiParams;

export async function getDashboardInsights(
  params: GetDashboardInsightsParams,
): Promise<ApiParsedResult<DashboardInsightsPayload>> {
  return apiGet('/api/v1/reporting/insights/dashboard', buildDashboardPeriodQuery(params));
}

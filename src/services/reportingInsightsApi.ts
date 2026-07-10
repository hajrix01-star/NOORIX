import type { ApiParsedResult } from '../types/api';
import type { DashboardInsightsPayload } from '../types/api/domains/dashboard';
import { apiGet } from './core/apiHttp';
import {
  buildDashboardPeriodQuery,
  type DashboardPeriodApiParams,
} from './domains/apiEndpoints/dashboard-period-query';

export type GetDashboardInsightsParams = DashboardPeriodApiParams;
export type { DashboardInsightsPayload };

export async function getDashboardInsights(
  params: GetDashboardInsightsParams,
): Promise<ApiParsedResult<DashboardInsightsPayload>> {
  return apiGet('/api/v1/reporting/insights/dashboard', buildDashboardPeriodQuery(params));
}

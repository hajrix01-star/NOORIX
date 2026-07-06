import type { ApiParsedResult } from '../../../types/api';
import type { DashboardOverviewData } from '../../../types/api/domains/dashboard';
import { apiGet } from '../../core/apiHttp';
import { buildDashboardPeriodQuery, type DashboardPeriodApiParams } from './dashboard-period-query';

export interface DashboardOverviewParams extends DashboardPeriodApiParams {}

/**
 * GET /api/v1/dashboard/overview
 * طلب واحد يجمع: P&L + Sales Pack + Insights + Period Analytics
 */
export async function getDashboardOverview(p: DashboardOverviewParams): Promise<ApiParsedResult<DashboardOverviewData>> {
  return apiGet('/api/v1/dashboard/overview', buildDashboardPeriodQuery(p));
}

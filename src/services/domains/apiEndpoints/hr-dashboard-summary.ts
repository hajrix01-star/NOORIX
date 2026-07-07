import type { ApiParsedResult } from '../../../types/api';
import { apiGet } from '../../core/apiHttp';

export interface HrDashboardSummaryData {
  leavesCount: number;
  expiringResidenciesCount: number;
  outstandingAdvancesCount: number;
  outstandingAdvancesAmount: number;
  activeCount: number;
  terminatedCount: number;
  monthlyPayrollTotal: number;
}

/**
 * GET /api/v1/hr/dashboard-summary
 * إجازات + إقامات منتهية + سلف مستحقة في طلب واحد.
 */
export async function getHrDashboardSummary(companyId: string): Promise<ApiParsedResult<HrDashboardSummaryData>> {
  return apiGet('/api/v1/hr/dashboard-summary', { companyId });
}

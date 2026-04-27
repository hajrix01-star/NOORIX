import type { ApiParsedResult } from '../../../types/api';
import { apiGet } from '../../core/apiHttp';

export async function getAnalyticsStudio(params: {
  startDate: string;
  endDate: string;
  companyId?: string;
}): Promise<ApiParsedResult> {
  const q: Record<string, string> = {
    startDate: params.startDate,
    endDate: params.endDate,
  };
  if (params.companyId) q.companyId = params.companyId;
  return apiGet('/api/v1/analytics/studio', q);
}

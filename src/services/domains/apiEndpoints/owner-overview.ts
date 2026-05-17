import type { ApiParsedResult } from '../../../types/api';
import { apiGet } from '../../core/apiHttp';

export interface OwnerOverviewParams {
  companyIds: string[];
  year: number;
  month?: number | null;
}

/**
 * GET /api/v1/owner/overview
 * P&L + مبيعات يومية لعدة شركات في طلب واحد.
 */
export async function getOwnerOverview(p: OwnerOverviewParams): Promise<ApiParsedResult> {
  const searchParams = new URLSearchParams();
  for (const id of p.companyIds) searchParams.append('companyIds', id);
  searchParams.set('year', String(p.year));
  if (p.month != null) searchParams.set('month', String(p.month));
  return apiGet(`/api/v1/owner/overview?${searchParams.toString()}`, {});
}

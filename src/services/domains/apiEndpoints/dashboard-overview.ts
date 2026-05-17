import type { ApiParsedResult } from '../../../types/api';
import { apiGet } from '../../core/apiHttp';

export interface DashboardOverviewParams {
  companyId: string;
  year: number;
  yearStart: string;
  yearEnd: string;
  periodStart: string;
  periodEnd: string;
  dailyStart?: string | null;
  dailyEnd?: string | null;
  monthStart?: string | null;
  monthEnd?: string | null;
  selectedMonth?: number | null;
  includeCancelledSales?: boolean;
}

/**
 * GET /api/v1/dashboard/overview
 * طلب واحد يجمع: P&L + Sales Pack + Insights + Period Analytics
 */
export async function getDashboardOverview(p: DashboardOverviewParams): Promise<ApiParsedResult> {
  const params: Record<string, string> = {
    companyId: p.companyId,
    year: String(p.year),
    yearStart: p.yearStart,
    yearEnd: p.yearEnd,
    periodStart: p.periodStart,
    periodEnd: p.periodEnd,
  };
  if (p.dailyStart) params.dailyStart = p.dailyStart;
  if (p.dailyEnd) params.dailyEnd = p.dailyEnd;
  if (p.monthStart) params.monthStart = p.monthStart;
  if (p.monthEnd) params.monthEnd = p.monthEnd;
  if (p.selectedMonth != null) params.selectedMonth = String(p.selectedMonth);
  if (p.includeCancelledSales) params.includeCancelledSales = 'true';

  return apiGet('/api/v1/dashboard/overview', params);
}

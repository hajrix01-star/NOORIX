import type { ApiParsedResult } from '../../../types/api';
import { apiGet, apiPut } from '../../core/apiHttp';

export interface DashboardCalendarDataResult {
  targets: { overall: number | null; byDow: Record<string, number> };
  specialDays: Array<{ id: string; name: string; fromDate: string; toDate: string; color: string }>;
  dayNotes: Record<string, string>;
}

/**
 * GET /api/v1/dashboard/calendar?companyId=&year=&month=
 */
export async function getDashboardCalendarData(
  companyId: string,
  year: number,
  month: number,
): Promise<ApiParsedResult> {
  return apiGet('/api/v1/dashboard/calendar', {
    companyId,
    year: String(year),
    month: String(month),
  });
}

/**
 * PUT /api/v1/dashboard/calendar/targets
 */
export async function putDashboardCalendarTargets(
  companyId: string,
  year: number,
  month: number,
  targets: { overall: number | null; byDow: Record<string, number> },
): Promise<ApiParsedResult> {
  return apiPut(
    `/api/v1/dashboard/calendar/targets?companyId=${encodeURIComponent(companyId)}&year=${year}&month=${month}`,
    { targets },
  );
}

/**
 * PUT /api/v1/dashboard/calendar/special-days
 */
export async function putDashboardCalendarSpecialDays(
  companyId: string,
  year: number,
  month: number,
  specialDays: unknown[],
): Promise<ApiParsedResult> {
  return apiPut(
    `/api/v1/dashboard/calendar/special-days?companyId=${encodeURIComponent(companyId)}&year=${year}&month=${month}`,
    { specialDays },
  );
}

/**
 * PUT /api/v1/dashboard/calendar/day-notes
 */
export async function putDashboardCalendarDayNotes(
  companyId: string,
  year: number,
  month: number,
  dayNotes: Record<string, string>,
): Promise<ApiParsedResult> {
  return apiPut(
    `/api/v1/dashboard/calendar/day-notes?companyId=${encodeURIComponent(companyId)}&year=${year}&month=${month}`,
    { dayNotes },
  );
}

import type { ApiParsedResult } from '../../../types/api';
import type {
  DashboardCalendarDataResult,
  DashboardCalendarTargets,
  DashboardSpecialDay,
} from '../../../types/api/domains/dashboard';
import { apiGet, apiPost, apiPut, apiDelete } from '../../core/apiHttp';

export async function getDashboardCalendarData(
  companyId: string,
  year: number,
  month: number,
): Promise<ApiParsedResult<DashboardCalendarDataResult>> {
  return apiGet('/api/v1/dashboard/calendar', {
    companyId,
    year: String(year),
    month: String(month),
  });
}

export async function putDashboardCalendarTargets(
  companyId: string,
  year: number,
  month: number,
  targets: DashboardCalendarTargets,
  applyToAll = true,
): Promise<ApiParsedResult<DashboardCalendarDataResult>> {
  return apiPut(
    `/api/v1/dashboard/calendar/targets?companyId=${encodeURIComponent(companyId)}&year=${year}&month=${month}&applyToAll=${applyToAll}`,
    { targets },
  );
}

export async function deleteDashboardCalendarTargets(
  companyId: string,
  year: number,
  month: number,
): Promise<ApiParsedResult<DashboardCalendarDataResult>> {
  return apiDelete(
    `/api/v1/dashboard/calendar/targets?companyId=${encodeURIComponent(companyId)}&year=${year}&month=${month}`,
  );
}

export async function putDashboardCalendarSpecialDays(
  companyId: string,
  year: number,
  month: number,
  specialDays: DashboardSpecialDay[],
): Promise<ApiParsedResult<DashboardCalendarDataResult>> {
  return apiPut(
    `/api/v1/dashboard/calendar/special-days?companyId=${encodeURIComponent(companyId)}&year=${year}&month=${month}`,
    { specialDays },
  );
}

export type SaudiOccasionDto = {
  id: string;
  kind: string;
  nameAr: string;
  nameEn: string;
  fromDate: string;
  toDate: string;
  color: string;
  estimated: boolean;
};

export async function getDashboardSaudiOccasions(
  year: number,
  companyId?: string,
): Promise<ApiParsedResult<SaudiOccasionDto[]>> {
  return apiGet('/api/v1/dashboard/calendar/saudi-occasions', {
    year: String(year),
    ...(companyId ? { companyId } : {}),
  });
}

export async function applyDashboardSpecialOccasions(
  companyId: string,
  payload: {
    year: number;
    occasionIds: string[];
    scope: 'company' | 'tenant';
    companyIds?: string[];
    lang?: 'ar' | 'en';
    dayShifts?: Record<string, number>;
  },
): Promise<ApiParsedResult<{ companies: number; monthsUpdated: number; occasionCount: number }>> {
  return apiPost(
    `/api/v1/dashboard/calendar/special-days/apply-occasions?companyId=${encodeURIComponent(companyId)}`,
    payload,
  );
}

export async function putDashboardCalendarDayNotes(
  companyId: string,
  year: number,
  month: number,
  dayNotes: Record<string, string>,
): Promise<ApiParsedResult<DashboardCalendarDataResult>> {
  return apiPut(
    `/api/v1/dashboard/calendar/day-notes?companyId=${encodeURIComponent(companyId)}&year=${year}&month=${month}`,
    { dayNotes },
  );
}

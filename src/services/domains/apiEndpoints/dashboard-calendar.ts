import type { ApiParsedResult } from '../../../types/api';
import { apiGet, apiPost, apiPut, apiDelete } from '../../core/apiHttp';

export interface DashboardCalendarDataResult {
  targets: { overall: number | null; byDow: Record<string, number> };
  specialDays: Array<{ id: string; name: string; fromDate: string; toDate: string; color: string }>;
  dayNotes: Record<string, string>;
  /** true إذا كان الهدف المعروض هو الهدف الافتراضي (month=0) لا تخصيص خاص بالشهر */
  isDefaultTargets: boolean;
  /** true إذا كان هناك تخصيص خاص بهذا الشهر */
  hasMonthOverride: boolean;
  /** الهدف الافتراضي المحفوظ لكل الشهور */
  defaultTargets: { overall: number | null; byDow: Record<string, number> };
}

/**
 * GET /api/v1/dashboard/calendar?companyId=&year=&month=
 */
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

/**
 * PUT /api/v1/dashboard/calendar/targets?applyToAll=true|false
 * applyToAll=true  → يحفظ كهدف افتراضي لكل الشهور (month=0)
 * applyToAll=false → يحفظ تخصيصاً لهذا الشهر فقط
 */
export async function putDashboardCalendarTargets(
  companyId: string,
  year: number,
  month: number,
  targets: { overall: number | null; byDow: Record<string, number> },
  applyToAll = true,
): Promise<ApiParsedResult<DashboardCalendarDataResult>> {
  return apiPut(
    `/api/v1/dashboard/calendar/targets?companyId=${encodeURIComponent(companyId)}&year=${year}&month=${month}&applyToAll=${applyToAll}`,
    { targets },
  );
}

/**
 * DELETE /api/v1/dashboard/calendar/targets — إعادة الشهر للهدف الافتراضي
 */
export async function deleteDashboardCalendarTargets(
  companyId: string,
  year: number,
  month: number,
): Promise<ApiParsedResult<DashboardCalendarDataResult>> {
  return apiDelete(
    `/api/v1/dashboard/calendar/targets?companyId=${encodeURIComponent(companyId)}&year=${year}&month=${month}`,
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
): Promise<ApiParsedResult<DashboardCalendarDataResult>> {
  return apiPut(
    `/api/v1/dashboard/calendar/special-days?companyId=${encodeURIComponent(companyId)}&year=${year}&month=${month}`,
    { specialDays },
  );
}

/**
 * PUT /api/v1/dashboard/calendar/day-notes
 */
export type SaudiOccasionDto = {
  id: string;
  kind: string;
  nameAr: string;
  nameEn: string;
  fromDate: string;
  toDate: string;
  color: string;
  /** أم القرى — قد يختلف يوماً عن الإعلان الرسمي للعيدين */
  estimated: boolean;
};

export async function getDashboardSaudiOccasions(
  year: number,
): Promise<ApiParsedResult<SaudiOccasionDto[]>> {
  return apiGet('/api/v1/dashboard/calendar/saudi-occasions', { year: String(year) });
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

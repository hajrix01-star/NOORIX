/**
 * تطبيق المناسبات عبر واجهات التقويم الحالية (احتياط عند 404 على apply-occasions).
 */
import {
  getDashboardCalendarData,
  putDashboardCalendarSpecialDays,
} from '../services/domains/apiEndpoints/dashboard-calendar';
import { unwrapApiDataOr } from '../services/core/apiHttp';
import type { ApiParsedResult } from '../types/api';
import { getSaudiOccasionsForYear, shiftGregorianYmd } from './saudiOccasions.umalqura';
import { mergeSpecialDayPeriods, occasionsToSpecialDayPeriods, type SpecialDayPeriod } from './saudiOccasionsPeriods';

const EMPTY = {
  targets: { overall: null as number | null, byDow: {} as Record<string, number> },
  specialDays: [] as SpecialDayPeriod[],
  dayNotes: {} as Record<string, string>,
  isDefaultTargets: true,
  hasMonthOverride: false,
  defaultTargets: { overall: null as number | null, byDow: {} as Record<string, number> },
};

export function isSaudiOccasionsApiMissing(res: ApiParsedResult<unknown>): boolean {
  if (res.code === 404) return true;
  const msg = String(res.error ?? '');
  return msg.includes('Cannot GET') || msg.includes('Cannot POST');
}

export async function fetchSaudiOccasionsCatalog(year: number, companyId: string) {
  const { getDashboardSaudiOccasions } = await import(
    '../services/domains/apiEndpoints/dashboard-calendar'
  );
  const res = await getDashboardSaudiOccasions(year, companyId);
  if (res.success && Array.isArray(res.data) && res.data.length > 0) return res.data;
  if (isSaudiOccasionsApiMissing(res) || !res.success) {
    return getSaudiOccasionsForYear(year);
  }
  if (!res.data?.length) {
    return getSaudiOccasionsForYear(year);
  }
  return res.data;
}

export async function applySaudiOccasionsViaCalendar(params: {
  companyIds: string[];
  year: number;
  occasionIds: string[];
  lang: 'ar' | 'en';
  dayShifts?: Record<string, number>;
}): Promise<{ companies: number; monthsUpdated: number; occasionCount: number }> {
  const { companyIds, year, occasionIds, lang, dayShifts } = params;
  const catalog = getSaudiOccasionsForYear(year);
  const selected = catalog
    .filter((o) => occasionIds.includes(o.id))
    .map((o) => {
      const raw = dayShifts?.[o.id];
      const shift =
        typeof raw === 'number' && Number.isFinite(raw)
          ? Math.max(-3, Math.min(3, Math.trunc(raw)))
          : 0;
      if (!shift) return o;
      return {
        ...o,
        fromDate: shiftGregorianYmd(o.fromDate, shift),
        toDate: shiftGregorianYmd(o.toDate, shift),
      };
    });

  if (!selected.length) {
    return { companies: 0, monthsUpdated: 0, occasionCount: 0 };
  }

  const byMonth = occasionsToSpecialDayPeriods(year, selected, lang);
  let monthsUpdated = 0;

  for (const companyId of companyIds) {
    for (const [month, periods] of byMonth.entries()) {
      const res = await getDashboardCalendarData(companyId, year, month);
      const data = unwrapApiDataOr(res, EMPTY);
      const existing = (data.specialDays ?? []) as SpecialDayPeriod[];
      const merged = mergeSpecialDayPeriods(existing, periods);
      await putDashboardCalendarSpecialDays(companyId, year, month, merged);
      monthsUpdated += 1;
    }
  }

  return {
    companies: companyIds.length,
    monthsUpdated,
    occasionCount: selected.length,
  };
}

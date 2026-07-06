/**
 * أيام خاصة لسنة كاملة — دمج من 12 شهراً (لتبويب الأيام الخاصة بعد استيراد المناسبات).
 */
import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { dashboardKeys } from '../services/queryKeys/dashboard';
import {
  getDashboardCalendarData,
  putDashboardCalendarSpecialDays,
} from '../services/domains/apiEndpoints/dashboard-calendar';
import type { DashboardCalendarDataResult, DashboardSpecialDay } from '../types/api/domains/dashboard';
import { unwrapApiDataOr } from '../services/core/apiHttp';
import { useApiQueries } from './useApiQuery';

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const EMPTY_CALENDAR: DashboardCalendarDataResult = {
  targets: { overall: null, byDow: {} },
  specialDays: [],
  dayNotes: {},
  isDefaultTargets: true,
  hasMonthOverride: false,
  defaultTargets: { overall: null, byDow: {} },
};

export type DashboardSpecialDayRow = {
  id: string;
  name: string;
  fromDate: string;
  toDate: string;
  color: string;
};

function normalizeSpecialDayRow(sp: DashboardSpecialDay): DashboardSpecialDayRow {
  return {
    id: sp.id,
    name: sp.name ?? '',
    fromDate: sp.fromDate,
    toDate: sp.toDate,
    color: sp.color ?? '#8b5cf6',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== 'object') return false;
  return true;
}

function isDashboardCalendarDataResult(value: unknown): value is DashboardCalendarDataResult {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.specialDays) &&
    isRecord(value.targets) &&
    isRecord(value.defaultTargets) &&
    isRecord(value.dayNotes)
  );
}

function calendarDataOrEmpty(value: unknown): DashboardCalendarDataResult {
  return isDashboardCalendarDataResult(value) ? value : EMPTY_CALENDAR;
}

export function useDashboardYearSpecialDays({
  companyId,
  year,
  enabled = true,
}: {
  companyId: string | null | undefined;
  year: number;
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const isEnabled = !!companyId && enabled;

  const monthQueries = useApiQueries({
    queries: MONTHS.map((month) => ({
      queryKey: dashboardKeys.calendar(companyId ?? '', year, month),
      queryFn: async () => {
        const res = await getDashboardCalendarData(companyId!, year, month);
        return { success: true as const, data: unwrapApiDataOr(res, EMPTY_CALENDAR) };
      },
      fallbackMessage: 'Failed to load dashboard calendar data',
      enabled: isEnabled,
      staleTime: 5 * 60 * 1000,
    })),
  });

  const specialDays = useMemo(() => {
    const rows: DashboardSpecialDayRow[] = [];
    for (const q of monthQueries) {
      const data = calendarDataOrEmpty(q.data);
      for (const sp of data.specialDays ?? []) {
        if (!sp?.id) continue;
        rows.push(normalizeSpecialDayRow(sp));
      }
    }
    return rows.sort(
      (a, b) => a.fromDate.localeCompare(b.fromDate) || a.name.localeCompare(b.name),
    );
  }, [monthQueries]);

  const isLoading = monthQueries.some((q) => q.isLoading);
  const isFetching = monthQueries.some((q) => q.isFetching);

  const invalidateYear = () =>
    queryClient.invalidateQueries({ queryKey: dashboardKeys.calendarRoot() });

  const getMonthSpecialDays = (month: number): DashboardSpecialDayRow[] => {
    const q = monthQueries[month - 1];
    const data = calendarDataOrEmpty(q.data);
    return (data.specialDays ?? []).map(normalizeSpecialDayRow);
  };

  const saveMonthSpecialDays = async (month: number, specialDaysList: DashboardSpecialDayRow[]) => {
    const res = await putDashboardCalendarSpecialDays(companyId!, year, month, specialDaysList);
    const data = unwrapApiDataOr(res, EMPTY_CALENDAR);
    queryClient.setQueryData(dashboardKeys.calendar(companyId!, year, month), data);
  };

  /** يحدّث الاسم/اللون في كل الأشهر التي تحتوي نفس المعرّف */
  const updateSpecialDayById = async (id: string, updates: Partial<DashboardSpecialDayRow>) => {
    await Promise.all(
      MONTHS.map(async (month) => {
        const list = getMonthSpecialDays(month);
        if (!list.some((sp) => sp.id === id)) return;
        await saveMonthSpecialDays(
          month,
          list.map((sp) => (sp.id === id ? { ...sp, ...updates } : sp)),
        );
      }),
    );
    await invalidateYear();
  };

  /** يزيل معرّفاً من كل الأشهر التي تحتويه (مناسبات مستوردة قد تتكرر بنفس id) */
  const removeSpecialDayById = async (id: string) => {
    await Promise.all(
      MONTHS.map(async (month) => {
        const q = monthQueries[month - 1];
        const data = calendarDataOrEmpty(q.data);
        const list = (data.specialDays ?? []).map(normalizeSpecialDayRow);
        if (!list.some((sp) => sp.id === id)) return;
        await saveMonthSpecialDays(
          month,
          list.filter((sp) => sp.id !== id),
        );
      }),
    );
    await invalidateYear();
  };

  return {
    specialDays,
    isLoading,
    isFetching,
    invalidateYear,
    getMonthSpecialDays,
    saveMonthSpecialDays,
    updateSpecialDayById,
    removeSpecialDayById,
    monthQueries,
  };
}

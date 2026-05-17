/**
 * Hook لبيانات تقويم لوحة التحكم — نظام طبقي للأهداف:
 * - month=0: هدف افتراضي لكل الشهور
 * - month=X: تخصيص لشهر محدد (يطغى على الافتراضي)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardKeys } from '../services/queryKeys/dashboard';
import {
  getDashboardCalendarData,
  putDashboardCalendarTargets,
  putDashboardCalendarSpecialDays,
  putDashboardCalendarDayNotes,
  deleteDashboardCalendarTargets,
} from '../services/domains/apiEndpoints/dashboard-calendar';

const DEFAULT_TARGETS = { overall: null as number | null, byDow: {} as Record<string, number> };

const DEFAULT_CALENDAR_DATA = {
  targets: DEFAULT_TARGETS,
  specialDays: [] as Array<{ id: string; name: string; fromDate: string; toDate: string; color: string }>,
  dayNotes: {} as Record<string, string>,
  isDefaultTargets: true,
  hasMonthOverride: false,
  defaultTargets: DEFAULT_TARGETS,
};

interface UseCalendarDataOptions {
  companyId: string | null | undefined;
  year: number;
  month: number;
  enabled?: boolean;
}

export function useDashboardCalendarData({ companyId, year, month, enabled = true }: UseCalendarDataOptions) {
  const queryClient = useQueryClient();
  const isEnabled = !!companyId && enabled;

  const query = useQuery({
    queryKey: dashboardKeys.calendar(companyId ?? '', year, month),
    queryFn: async () => {
      const res = await getDashboardCalendarData(companyId!, year, month);
      return (res as any)?.data ?? res ?? DEFAULT_CALENDAR_DATA;
    },
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: DEFAULT_CALENDAR_DATA,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: dashboardKeys.calendar(companyId ?? '', year, month) });

  const targetsMutation = useMutation({
    mutationFn: ({
      targets,
      applyToAll = true,
    }: {
      targets: { overall: number | null; byDow: Record<string, number> };
      applyToAll?: boolean;
    }) => putDashboardCalendarTargets(companyId!, year, month, targets, applyToAll),
    onSuccess: (res: any) => {
      const data = res?.data ?? res;
      if (data) queryClient.setQueryData(dashboardKeys.calendar(companyId!, year, month), data);
      else invalidate();
    },
  });

  const resetTargetsMutation = useMutation({
    mutationFn: () => deleteDashboardCalendarTargets(companyId!, year, month),
    onSuccess: (res: any) => {
      const data = res?.data ?? res;
      if (data) queryClient.setQueryData(dashboardKeys.calendar(companyId!, year, month), data);
      else invalidate();
    },
  });

  const specialDaysMutation = useMutation({
    mutationFn: (specialDays: unknown[]) =>
      putDashboardCalendarSpecialDays(companyId!, year, month, specialDays),
    onSuccess: (res: any) => {
      const data = res?.data ?? res;
      if (data) queryClient.setQueryData(dashboardKeys.calendar(companyId!, year, month), data);
      else invalidate();
    },
  });

  const dayNotesMutation = useMutation({
    mutationFn: (dayNotes: Record<string, string>) =>
      putDashboardCalendarDayNotes(companyId!, year, month, dayNotes),
    onSuccess: (res: any) => {
      const data = res?.data ?? res;
      if (data) queryClient.setQueryData(dashboardKeys.calendar(companyId!, year, month), data);
      else invalidate();
    },
  });

  const calendarData = query.data ?? DEFAULT_CALENDAR_DATA;

  return {
    isLoading: query.isLoading,
    targets: calendarData.targets ?? DEFAULT_TARGETS,
    specialDays: calendarData.specialDays ?? [],
    dayNotes: calendarData.dayNotes ?? {},
    /** true = يعرض الهدف الافتراضي (لكل الشهور)، false = تخصيص خاص بهذا الشهر */
    isDefaultTargets: calendarData.isDefaultTargets ?? true,
    /** true = يوجد تخصيص خاص بهذا الشهر */
    hasMonthOverride: calendarData.hasMonthOverride ?? false,
    /** الهدف الافتراضي المحفوظ لكل الشهور */
    defaultTargets: calendarData.defaultTargets ?? DEFAULT_TARGETS,
    saveTargets: (targets: { overall: number | null; byDow: Record<string, number> }, applyToAll?: boolean) =>
      targetsMutation.mutateAsync({ targets, applyToAll: applyToAll ?? true }),
    resetMonthTargets: () => resetTargetsMutation.mutateAsync(),
    saveSpecialDays: specialDaysMutation.mutateAsync,
    saveDayNotes: dayNotesMutation.mutateAsync,
  };
}

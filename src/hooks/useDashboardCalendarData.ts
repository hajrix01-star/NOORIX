/**
 * Hook لبيانات تقويم لوحة التحكم — أهداف المبيعات، الأيام الخاصة، الملاحظات
 * يحفظ البيانات في قاعدة البيانات بدلاً من localStorage
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardKeys } from '../services/queryKeys/dashboard';
import {
  getDashboardCalendarData,
  putDashboardCalendarTargets,
  putDashboardCalendarSpecialDays,
  putDashboardCalendarDayNotes,
} from '../services/domains/apiEndpoints/dashboard-calendar';

const DEFAULT_CALENDAR_DATA = {
  targets: { overall: null as number | null, byDow: {} as Record<string, number> },
  specialDays: [] as Array<{ id: string; name: string; fromDate: string; toDate: string; color: string }>,
  dayNotes: {} as Record<string, string>,
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
    mutationFn: (targets: { overall: number | null; byDow: Record<string, number> }) =>
      putDashboardCalendarTargets(companyId!, year, month, targets),
    onSuccess: (res: any) => {
      const data = res?.data ?? res;
      if (data) {
        queryClient.setQueryData(dashboardKeys.calendar(companyId!, year, month), data);
      } else {
        invalidate();
      }
    },
  });

  const specialDaysMutation = useMutation({
    mutationFn: (specialDays: unknown[]) =>
      putDashboardCalendarSpecialDays(companyId!, year, month, specialDays),
    onSuccess: (res: any) => {
      const data = res?.data ?? res;
      if (data) {
        queryClient.setQueryData(dashboardKeys.calendar(companyId!, year, month), data);
      } else {
        invalidate();
      }
    },
  });

  const dayNotesMutation = useMutation({
    mutationFn: (dayNotes: Record<string, string>) =>
      putDashboardCalendarDayNotes(companyId!, year, month, dayNotes),
    onSuccess: (res: any) => {
      const data = res?.data ?? res;
      if (data) {
        queryClient.setQueryData(dashboardKeys.calendar(companyId!, year, month), data);
      } else {
        invalidate();
      }
    },
  });

  const calendarData = query.data ?? DEFAULT_CALENDAR_DATA;

  return {
    isLoading: query.isLoading,
    targets: calendarData.targets ?? DEFAULT_CALENDAR_DATA.targets,
    specialDays: calendarData.specialDays ?? DEFAULT_CALENDAR_DATA.specialDays,
    dayNotes: calendarData.dayNotes ?? DEFAULT_CALENDAR_DATA.dayNotes,
    saveTargets: targetsMutation.mutateAsync,
    saveSpecialDays: specialDaysMutation.mutateAsync,
    saveDayNotes: dayNotesMutation.mutateAsync,
  };
}

import { useQueryClient } from '@tanstack/react-query';
import { dashboardKeys } from '../services/queryKeys/dashboard';
import {
  getDashboardCalendarData,
  putDashboardCalendarTargets,
  putDashboardCalendarSpecialDays,
  putDashboardCalendarDayNotes,
  deleteDashboardCalendarTargets,
} from '../services/domains/apiEndpoints/dashboard-calendar';
import type { ApiParsedResult } from '../types/api';
import type {
  DashboardCalendarDataResult,
  DashboardCalendarTargets,
  DashboardSpecialDay,
} from '../types/api/domains/dashboard';
import { useApiQueryOr } from './useApiQuery';
import { useApiMutation } from './useApiMutation';

const DEFAULT_TARGETS: DashboardCalendarTargets = { overall: null, byDow: {} };

const DEFAULT_CALENDAR_DATA: DashboardCalendarDataResult = {
  targets: DEFAULT_TARGETS,
  specialDays: [],
  dayNotes: {},
  isDefaultTargets: true,
  hasMonthOverride: false,
  defaultTargets: DEFAULT_TARGETS,
};

function applyCalendarMutationCache(
  queryClient: ReturnType<typeof useQueryClient>,
  companyId: string,
  year: number,
  month: number,
  res: ApiParsedResult<DashboardCalendarDataResult>,
) {
  const data = res.data;
  if (data) {
    queryClient.setQueryData(dashboardKeys.calendar(companyId, year, month), data);
  } else {
    queryClient.invalidateQueries({ queryKey: dashboardKeys.calendar(companyId, year, month) });
  }
}

interface UseCalendarDataOptions {
  companyId: string | null | undefined;
  year: number;
  month: number;
  enabled?: boolean;
}

export function useDashboardCalendarData({ companyId, year, month, enabled = true }: UseCalendarDataOptions) {
  const queryClient = useQueryClient();
  const isEnabled = !!companyId && enabled;

  const query = useApiQueryOr<DashboardCalendarDataResult>({
    queryKey: dashboardKeys.calendar(companyId ?? '', year, month),
    queryFn: () => getDashboardCalendarData(companyId!, year, month),
    fallback: DEFAULT_CALENDAR_DATA,
    fallbackMessage: 'Failed to load dashboard calendar data',
    enabled: isEnabled,
    staleTime: 5 * 60 * 1000,
    placeholderData: DEFAULT_CALENDAR_DATA,
  });

  const resetCacheFromResult = (res: ApiParsedResult<DashboardCalendarDataResult>) => {
    applyCalendarMutationCache(queryClient, companyId!, year, month, res);
  };

  const targetsMutation = useApiMutation({
    mutationFn: ({
      targets,
      applyToAll = true,
    }: {
      targets: DashboardCalendarTargets;
      applyToAll?: boolean;
    }) => putDashboardCalendarTargets(companyId!, year, month, targets, applyToAll),
    onSuccess: resetCacheFromResult,
    showErrorToast: false,
  });

  const resetTargetsMutation = useApiMutation({
    mutationFn: () => deleteDashboardCalendarTargets(companyId!, year, month),
    onSuccess: resetCacheFromResult,
    showErrorToast: false,
  });

  const specialDaysMutation = useApiMutation({
    mutationFn: (specialDays: DashboardSpecialDay[]) =>
      putDashboardCalendarSpecialDays(companyId!, year, month, specialDays),
    onSuccess: resetCacheFromResult,
    showErrorToast: false,
  });

  const dayNotesMutation = useApiMutation({
    mutationFn: (dayNotes: Record<string, string>) =>
      putDashboardCalendarDayNotes(companyId!, year, month, dayNotes),
    onSuccess: resetCacheFromResult,
    showErrorToast: false,
  });

  const calendarData = query.data ?? DEFAULT_CALENDAR_DATA;

  return {
    isLoading: query.isLoading,
    targets: calendarData.targets ?? DEFAULT_TARGETS,
    specialDays: calendarData.specialDays ?? [],
    dayNotes: calendarData.dayNotes ?? {},
    isDefaultTargets: calendarData.isDefaultTargets ?? true,
    hasMonthOverride: calendarData.hasMonthOverride ?? false,
    defaultTargets: calendarData.defaultTargets ?? DEFAULT_TARGETS,
    saveTargets: (targets: DashboardCalendarTargets, applyToAll?: boolean) =>
      targetsMutation.mutateAsync({ targets, applyToAll: applyToAll ?? true }),
    resetMonthTargets: () => resetTargetsMutation.mutateAsync(undefined),
    saveSpecialDays: specialDaysMutation.mutateAsync,
    saveDayNotes: dayNotesMutation.mutateAsync,
  };
}

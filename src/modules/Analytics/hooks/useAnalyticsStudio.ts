import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAnalyticsStudio } from '../../../services/domains/apiEndpoints/analytics';
import { throwIfApiFailed } from '../../../services/core/apiHttp';
import {
  normalizeAnalyticsStudioFilters,
  type AnalyticsStudioFilterState,
} from '../../../utils/analyticsStudioQueryKey';
import type { AnalyticsStudioPayload } from '../types';
import { hasPermission } from '../../../constants/permissions';

export function useAnalyticsStudio(
  filters: AnalyticsStudioFilterState,
  opts: { userRole?: string; userPermissions?: string[] },
) {
  const normalized = useMemo(() => normalizeAnalyticsStudioFilters(filters), [filters]);
  const canReadReports = hasPermission(opts.userRole, 'REPORTS_READ', opts.userPermissions);

  const query = useQuery({
    queryKey: ['analytics-studio', normalized],
    queryFn: async (): Promise<AnalyticsStudioPayload> => {
      const res = await getAnalyticsStudio({
        startDate: filters.startDate,
        endDate: filters.endDate,
        companyId: filters.companyScope === 'one' ? filters.companyId : undefined,
      });
      throwIfApiFailed(res);
      return res.data as AnalyticsStudioPayload;
    },
    enabled:
      canReadReports &&
      !!filters.startDate &&
      !!filters.endDate &&
      (filters.companyScope === 'all' || !!filters.companyId),
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  return { ...query, canReadReports };
}

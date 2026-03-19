import { useQuery } from '@tanstack/react-query';
import {
  getGeneralProfitLossDetails,
  getGeneralProfitLossReport,
  getGeneralProfitLossTrend,
  getPeriodAnalytics,
  getTaxVatReport,
} from '../services/api';

export function useReportsGeneralProfitLoss({ companyId, year }) {
  return useQuery({
    queryKey: ['reports', 'general-profit-loss', companyId, year],
    queryFn: async () => {
      const res = await getGeneralProfitLossReport(companyId, year);
      if (!res?.success) throw new Error(res?.error || 'Failed to load report');
      return res.data;
    },
    enabled: !!companyId && !!year,
  });
}

export function useReportDetails({ companyId, year, month, groupKey, itemKey, enabled = true }) {
  return useQuery({
    queryKey: ['reports', 'general-profit-loss', 'details', companyId, year, month, groupKey, itemKey || 'all'],
    queryFn: async () => {
      const res = await getGeneralProfitLossDetails(companyId, year, month, groupKey, itemKey);
      if (!res?.success) throw new Error(res?.error || 'Failed to load details');
      return res.data;
    },
    enabled: !!companyId && !!year && !!groupKey && enabled,
  });
}

export function useReportTrend({ companyId, year, groupKey, itemKey, enabled = true }) {
  return useQuery({
    queryKey: ['reports', 'general-profit-loss', 'trend', companyId, year, groupKey, itemKey || 'all'],
    queryFn: async () => {
      const res = await getGeneralProfitLossTrend(companyId, year, groupKey, itemKey);
      if (!res?.success) throw new Error(res?.error || 'Failed to load trend');
      return res.data;
    },
    enabled: !!companyId && !!year && !!groupKey && enabled,
  });
}

export function usePeriodAnalytics({ companyId, startDate, endDate, enabled = true }) {
  return useQuery({
    queryKey: ['reports', 'period-analytics', companyId, startDate, endDate],
    queryFn: async () => {
      const res = await getPeriodAnalytics(companyId, startDate, endDate);
      if (!res?.success) throw new Error(res?.error || 'Failed to load analytics');
      return res.data;
    },
    enabled: !!companyId && !!startDate && !!endDate && enabled,
    staleTime: 60_000,
  });
}

export function useTaxReport({ companyId, year, period, enabled = true }) {
  return useQuery({
    queryKey: ['reports', 'tax-vat', companyId, year, period],
    queryFn: async () => {
      const res = await getTaxVatReport(companyId, year, period);
      if (!res?.success) throw new Error(res?.error || 'Failed to load tax report');
      return res.data;
    },
    enabled: !!companyId && !!year && !!period && enabled,
  });
}

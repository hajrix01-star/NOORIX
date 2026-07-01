import { keepPreviousData } from '@tanstack/react-query';
import {
  getGeneralProfitLossDetails,
  getGeneralProfitLossReport,
  getGeneralProfitLossTrend,
  getPeriodAnalytics,
  getTaxVatReport,
} from '../services/api';
import { reportKeys } from '../services/queryKeys/reports';
import { useApiQuery } from './useApiQuery';
import type { GeneralProfitLossReport } from '../modules/Reports/reportTypes';

export function useReportsGeneralProfitLoss({
  companyId,
  year,
  enabled = true,
}: {
  companyId: string;
  year: number;
  enabled?: boolean;
}) {
  return useApiQuery<GeneralProfitLossReport>({
    queryKey: reportKeys.generalProfitLoss(companyId, year),
    queryFn: () => getGeneralProfitLossReport(companyId, year),
    fallbackMessage: 'Failed to load report',
    enabled: !!companyId && !!year && enabled,
    placeholderData: keepPreviousData,
  });
}

export function useReportDetails({
  companyId,
  year,
  month,
  groupKey,
  itemKey,
  enabled = true,
}: {
  companyId: string;
  year: number;
  month: number;
  groupKey: string;
  itemKey?: string;
  enabled?: boolean;
}) {
  return useApiQuery<any>({
    queryKey: reportKeys.generalProfitLossDetails(companyId, year, month, groupKey, itemKey),
    queryFn: () => getGeneralProfitLossDetails(companyId, year, month, groupKey, itemKey),
    fallbackMessage: 'Failed to load report details',
    enabled: !!companyId && !!year && !!groupKey && enabled,
  });
}

export function useReportTrend({
  companyId,
  year,
  groupKey,
  itemKey,
  enabled = true,
}: {
  companyId: string;
  year: number;
  groupKey: string;
  itemKey?: string;
  enabled?: boolean;
}) {
  return useApiQuery<any>({
    queryKey: reportKeys.generalProfitLossTrend(companyId, year, groupKey, itemKey),
    queryFn: () => getGeneralProfitLossTrend(companyId, year, groupKey, itemKey),
    fallbackMessage: 'Failed to load report trend',
    enabled: !!companyId && !!year && !!groupKey && enabled,
  });
}

export function usePeriodAnalytics({
  companyId,
  startDate,
  endDate,
  enabled = true,
}: {
  companyId: string;
  startDate: string;
  endDate: string;
  enabled?: boolean;
}) {
  return useApiQuery<any>({
    queryKey: reportKeys.periodAnalytics(companyId, startDate, endDate),
    queryFn: () => getPeriodAnalytics(companyId, startDate, endDate),
    fallbackMessage: 'Failed to load period analytics',
    enabled: !!companyId && !!startDate && !!endDate && enabled,
    staleTime: 60_000,
  });
}

export function useTaxReport({
  companyId,
  year,
  period,
  salesAmountIncludesVat = false,
  enabled = true,
}: {
  companyId: string;
  year: number;
  period: string | number;
  salesAmountIncludesVat?: boolean;
  enabled?: boolean;
}) {
  return useApiQuery<any>({
    queryKey: reportKeys.taxVat(companyId, year, period, salesAmountIncludesVat),
    queryFn: () => getTaxVatReport(companyId, year, String(period), {
      salesAmountIncludesVat,
    }),
    fallbackMessage: 'Failed to load VAT report',
    enabled: !!companyId && !!year && !!period && enabled,
  });
}

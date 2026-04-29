import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getGeneralProfitLossDetails,
  getGeneralProfitLossReport,
  getGeneralProfitLossTrend,
  getPeriodAnalytics,
  getTaxVatReport,
  throwIfApiFailed,
} from '../services/api';
import { reportKeys } from '../services/queryKeys/reports';

export function useReportsGeneralProfitLoss({
  companyId,
  year,
  enabled = true,
}: {
  companyId: string;
  year: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: reportKeys.generalProfitLoss(companyId, year),
    queryFn: async () => {
      const res = await getGeneralProfitLossReport(companyId, year);
      throwIfApiFailed(res, 'فشل تحميل التقرير');
      return res.data;
    },
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
  return useQuery({
    queryKey: reportKeys.generalProfitLossDetails(companyId, year, month, groupKey, itemKey),
    queryFn: async () => {
      const res = await getGeneralProfitLossDetails(companyId, year, month, groupKey, itemKey);
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل تفاصيل التقرير');
      return res.data;
    },
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
  return useQuery({
    queryKey: reportKeys.generalProfitLossTrend(companyId, year, groupKey, itemKey),
    queryFn: async () => {
      const res = await getGeneralProfitLossTrend(companyId, year, groupKey, itemKey);
      throwIfApiFailed(res, 'فشل تحميل اتجاه البند');
      return res.data;
    },
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
  return useQuery({
    queryKey: reportKeys.periodAnalytics(companyId, startDate, endDate),
    queryFn: async () => {
      const res = await getPeriodAnalytics(companyId, startDate, endDate);
      throwIfApiFailed(res, 'فشل تحميل تحليل الفترة');
      return res.data;
    },
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
  return useQuery({
    queryKey: reportKeys.taxVat(companyId, year, period, salesAmountIncludesVat),
    queryFn: async () => {
      const res = await getTaxVatReport(companyId, year, String(period), {
        salesAmountIncludesVat,
      });
      throwIfApiFailed(res, 'فشل تحميل التقرير الضريبي');
      return res.data;
    },
    enabled: !!companyId && !!year && !!period && enabled,
  });
}

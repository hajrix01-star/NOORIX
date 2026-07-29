import {
  createStaffOrder,
  deleteStaffOrder,
  getDigestHistory,
  getMyStaffOrders,
  getSalesReport,
  getStaffDigest,
  getStaffSaleNextLogRef,
  resendStaffSale,
  sendStaffDigest,
  updateStaffOrder,
} from '../../services/api';
import { orderKeys } from '../../services/queryKeys';
import type {
  DigestHistoryDay,
  StaffDigestData,
  StaffOrder,
  StaffOrderPayload,
  StaffSaleNextLogRef,
  StaffSaleReport,
} from '../../types/api';
import { useApiMutation } from '../useApiMutation';
import { useApiListQuery, useApiQuery, useApiQueryOr } from '../useApiQuery';

type MutationArgs<TBody> = { id: string; body: TBody };

const emptyStaffDigest: StaffDigestData = {
  sections: [],
  totalOrders: 0,
  pendingCount: 0,
};

const emptyStaffSaleReport: StaffSaleReport = {
  summary: {
    totalOrders: 0,
    totalQty: 0,
    totalAmount: 0,
    avgPerOrder: 0,
    uniqueProducts: 0,
    uniqueSections: 0,
  },
  byProduct: [],
  bySection: [],
  byUser: [],
  byDay: [],
  byLog: [],
};

export function useMyStaffOrders(companyId: string) {
  return useApiListQuery<StaffOrder>({
    queryKey: orderKeys.staffMy(companyId),
    queryFn: () => getMyStaffOrders(companyId),
    fallbackMessage: 'Failed to load staff orders',
    enabled: !!companyId,
  });
}

export function useStaffSaleNextLogRef(companyId: string, saleDate: string, enabled = true) {
  return useApiQuery<StaffSaleNextLogRef, string>({
    queryKey: ['staffSaleNextLogRef', companyId, saleDate],
    queryFn: () => getStaffSaleNextLogRef(companyId, saleDate),
    fallbackMessage: 'Failed to load next staff sale reference',
    enabled: !!companyId && !!saleDate && enabled,
    staleTime: 15_000,
    select: (data) => String(data?.logRef ?? ''),
  });
}

export function useCreateStaffOrderMutation(companyId: string) {
  return useApiMutation({
    mutationFn: createStaffOrder,
    invalidateQueries: [
      orderKeys.staffMy(companyId),
      orderKeys.staffDigest(companyId),
      ['salesReport', companyId],
      ['staffSaleNextLogRef', companyId],
      orderKeys.shishaInventoryRoot(),
    ],
    showErrorToast: false,
  });
}

export function useUpdateStaffOrderMutation(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, body }: MutationArgs<Partial<StaffOrderPayload>>) => updateStaffOrder(id, companyId, body),
    invalidateQueries: [
      orderKeys.staffMy(companyId),
      orderKeys.staffDigest(companyId),
      ['salesReport', companyId],
      orderKeys.shishaInventoryRoot(),
    ],
    showErrorToast: false,
  });
}

export function useDeleteStaffOrderMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (id: string) => deleteStaffOrder(id, companyId),
    invalidateQueries: [
      orderKeys.staffMy(companyId),
      orderKeys.staffDigest(companyId),
      ['salesReport', companyId],
      orderKeys.shishaInventoryRoot(),
    ],
    showErrorToast: false,
  });
}

export function useResendStaffSaleMutation(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, lang }: { id: string; lang?: 'ar' | 'en' }) =>
      resendStaffSale(id, companyId, lang),
    invalidateQueries: [orderKeys.staffMy(companyId)],
    showErrorToast: false,
  });
}

export function useStaffDigest(companyId: string) {
  return useApiQueryOr<StaffDigestData>({
    queryKey: orderKeys.staffDigest(companyId),
    queryFn: () => getStaffDigest(companyId),
    fallback: emptyStaffDigest,
    fallbackMessage: 'Failed to load staff digest',
    enabled: !!companyId,
  });
}

export function useSalesReport(
  companyId: string,
  period: number | { startDate: string; endDate: string } = 30,
) {
  const periodKey = typeof period === 'number'
    ? `days:${period}`
    : `range:${period.startDate}:${period.endDate}`;
  return useApiQueryOr<StaffSaleReport>({
    queryKey: ['salesReport', companyId, periodKey],
    queryFn: () => getSalesReport(companyId, period),
    fallback: emptyStaffSaleReport,
    fallbackMessage: 'Failed to load sales report',
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function useDigestHistory(companyId: string, days = 30) {
  return useApiListQuery<DigestHistoryDay>({
    queryKey: ['digestHistory', companyId, days],
    queryFn: () => getDigestHistory(companyId, days),
    fallbackMessage: 'Failed to load digest history',
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function useSendStaffDigestMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (body: {
      orderIds?: string[];
      lang?: 'ar' | 'en';
      orderType?: 'external' | 'internal';
      pettyCashAmount?: string;
      orderDate?: string;
      createPurchaseOrder?: boolean;
    } = {}) => sendStaffDigest(companyId, body),
    invalidateQueries: [
      orderKeys.staffDigest(companyId),
      orderKeys.staffMyRoot(),
      orderKeys.listRoot(),
      orderKeys.summaryRoot(),
      orderKeys.rangeSummaryRoot(),
    ],
    showErrorToast: false,
  });
}

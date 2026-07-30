import {
  createStaffOrder,
  deleteStaffOrder,
  getMyStaffOrders,
  getSalesReport,
  getStaffSaleDateStatus,
  getStaffSaleNextLogRef,
  resendStaffOrder,
  updateStaffOrder,
} from '../../services/api';
import { orderKeys } from '../../services/queryKeys';
import type {
  StaffOrder,
  StaffOrderPayload,
  StaffSaleDateStatus,
  StaffSaleNextLogRef,
  StaffSaleReport,
} from '../../types/api';
import { useApiMutation } from '../useApiMutation';
import { useApiListQuery, useApiQuery, useApiQueryOr } from '../useApiQuery';

type MutationArgs<TBody> = { id: string; body: TBody };

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
  registrationCoverage: {
    startDate: '',
    endDate: '',
    expectedSectionDays: 0,
    registeredSectionDays: 0,
    missingSectionDays: 0,
    affectedSections: 0,
    sections: [],
    missingDays: [],
  },
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

export function useStaffSaleDateStatus(companyId: string, sectionName: string, enabled = true) {
  return useApiQuery<StaffSaleDateStatus>({
    queryKey: ['staffSaleDateStatus', companyId, sectionName],
    queryFn: () => getStaffSaleDateStatus(companyId, sectionName),
    fallbackMessage: 'Failed to load staff sale date status',
    enabled: !!companyId && !!sectionName && enabled,
    staleTime: 15_000,
  });
}

export function useCreateStaffOrderMutation(companyId: string) {
  return useApiMutation({
    mutationFn: createStaffOrder,
    invalidateQueries: [
      orderKeys.staffMy(companyId),
      ['salesReport', companyId],
      ['staffSaleNextLogRef', companyId],
      ['staffSaleDateStatus', companyId],
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
      ['salesReport', companyId],
      ['staffSaleDateStatus', companyId],
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
      ['salesReport', companyId],
      ['staffSaleDateStatus', companyId],
      orderKeys.shishaInventoryRoot(),
    ],
    showErrorToast: false,
  });
}

export function useResendStaffOrderMutation(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, lang }: { id: string; lang?: 'ar' | 'en' }) =>
      resendStaffOrder(id, companyId, lang),
    invalidateQueries: [orderKeys.staffMy(companyId)],
    showErrorToast: false,
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

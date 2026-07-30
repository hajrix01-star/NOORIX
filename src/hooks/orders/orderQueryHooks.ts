import { useMemo } from 'react';
import {
  cancelOrder,
  createOrder,
  getOrders,
  getOrdersItemsReport,
  getOrdersItemsReportRange,
  getOrdersRangeSummary,
  getOrdersSummary,
  updateOrder,
} from '../../services/api';
import { orderKeys } from '../../services/queryKeys';
import type {
  OrderItemsReportRow,
  OrderItemsReportResult,
  OrderRangeSummary,
  OrderRecord,
  OrderSummary,
  UpdateOrderPayload,
} from '../../types/api';
import { listYearMonthsInRange } from '../../utils/datePeriod';
import { useApiMutation } from '../useApiMutation';
import { useApiListQuery, useApiQueries, useApiQuery, useApiQueryOr } from '../useApiQuery';

type MutationArgs<TBody> = { id: string; body: TBody };

const emptyOrderSummary: OrderSummary = {
  pettyCashTotal: 0,
  delegatePurchasesTotal: 0,
  localPurchasesTotal: 0,
  delegateBalance: 0,
};

export function useOrders(companyId: string, year: string | number, month: string | number) {
  return useApiListQuery<OrderRecord>({
    queryKey: orderKeys.list(companyId, year, month),
    queryFn: () => getOrders(companyId, year, month),
    fallbackMessage: 'Failed to load orders',
    enabled: !!companyId && !!year && !!month,
  });
}

export function useOrdersRange(companyId: string, startDate: string, endDate: string) {
  const months = useMemo(() => listYearMonthsInRange(startDate, endDate), [startDate, endDate]);
  const results = useApiQueries({
    queries: months.map(({ year, month }) => ({
      queryKey: orderKeys.list(companyId, year, month),
      queryFn: () => getOrders(companyId, year, month),
      fallbackMessage: 'Failed to load orders',
      enabled: !!companyId && months.length > 0,
    })),
  });

  const data = useMemo(
    () => results.flatMap((result) => (Array.isArray(result.data) ? result.data as OrderRecord[] : [])),
    [results],
  );

  return {
    data,
    isLoading: results.some((result) => result.isLoading),
    isFetching: results.some((result) => result.isFetching),
    error: results.find((result) => result.error)?.error as Error | null | undefined,
  };
}

export function useCreateOrderMutation(companyId?: string) {
  return useApiMutation({
    mutationFn: createOrder,
    invalidateQueries: [
      orderKeys.listRoot(),
      orderKeys.summaryRoot(),
      orderKeys.rangeSummaryRoot(),
      ...(companyId ? [orderKeys.products(companyId)] : [orderKeys.productsRoot()]),
    ],
    showErrorToast: false,
  });
}

export function useUpdateOrderMutation(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, body }: MutationArgs<UpdateOrderPayload>) => updateOrder(id, body, companyId),
    invalidateQueries: [
      orderKeys.listRoot(),
      orderKeys.summaryRoot(),
      orderKeys.rangeSummaryRoot(),
      ...(companyId ? [orderKeys.products(companyId)] : []),
    ],
    showErrorToast: false,
  });
}

export function useCancelOrderMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (id: string) => cancelOrder(id, companyId),
    invalidateQueries: [orderKeys.listRoot(), orderKeys.summaryRoot(), orderKeys.rangeSummaryRoot()],
    showErrorToast: false,
  });
}

export function useOrdersSummary(companyId: string, year: string | number, month: string | number) {
  return useApiQueryOr<OrderSummary>({
    queryKey: orderKeys.summary(companyId, year, month),
    queryFn: () => getOrdersSummary(companyId, year, month),
    fallback: emptyOrderSummary,
    fallbackMessage: 'Failed to load orders summary',
    enabled: !!companyId && !!year && !!month,
  });
}

export function useOrdersRangeSummary(companyId: string, startDate: string, endDate: string) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const hasValidRange = datePattern.test(startDate) && datePattern.test(endDate) && startDate <= endDate;
  return useApiQuery<OrderRangeSummary>({
    queryKey: orderKeys.rangeSummary(companyId, startDate, endDate),
    queryFn: () => getOrdersRangeSummary(companyId, startDate, endDate),
    fallbackMessage: 'Failed to load orders range summary',
    enabled: !!companyId && hasValidRange,
  });
}

export function useOrdersItemsReport(companyId: string, year: string | number, month: string | number) {
  return useApiListQuery<OrderItemsReportRow>({
    queryKey: orderKeys.itemsReport(companyId, year, month),
    queryFn: () => getOrdersItemsReport(companyId, year, month),
    fallbackMessage: 'Failed to load orders items report',
    enabled: !!companyId && !!year && !!month,
  });
}

export function useOrdersItemsReportRange(companyId: string, startDate: string, endDate: string) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const hasValidRange = datePattern.test(startDate) && datePattern.test(endDate) && startDate <= endDate;
  return useApiQuery<OrderItemsReportResult>({
    queryKey: orderKeys.itemsReportRange(companyId, startDate, endDate),
    queryFn: () => getOrdersItemsReportRange(companyId, startDate, endDate),
    fallbackMessage: 'Failed to load orders items report range',
    enabled: !!companyId && hasValidRange,
  });
}

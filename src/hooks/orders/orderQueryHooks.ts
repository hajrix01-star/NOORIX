import { useMemo } from 'react';
import {
  cancelOrder,
  createInventoryStocktake,
  createOrder,
  getInventoryDataQuality,
  getOrders,
  getOrdersItemsReport,
  getOrdersItemsReportRange,
  getInventoryStocktakes,
  getOrdersRecipeInventoryStock,
  getOrdersRangeSummary,
  getOrdersSummary,
  updateOrder,
} from '../../services/api';
import { orderKeys } from '../../services/queryKeys';
import type {
  OrderItemsReportRow,
  OrderItemsReportResult,
  CreateInventoryStocktakePayload,
  InventoryDataQualityReport,
  InventoryStocktake,
  OrderRecipeInventoryStockRow,
  OrderRangeSummary,
  OrderRecord,
  OrderSummary,
  UpdateOrderPayload,
} from '../../types/api';
import { listYearMonthsInRange } from '../../utils/datePeriod';
import { toYmd } from '../../utils/saudiDate';
import { useApiMutation } from '../useApiMutation';
import { useApiListQuery, useApiQueries, useApiQuery, useApiQueryOr } from '../useApiQuery';

type MutationArgs<TBody> = { id: string; body: TBody };

const emptyOrderSummary: OrderSummary = {
  pettyCashTotal: 0,
  delegatePurchasesTotal: 0,
  localPurchasesTotal: 0,
  transferPurchasesTotal: 0,
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
      orderKeys.recipeInventoryStockRoot(),
      orderKeys.inventoryDataQualityRoot(),
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
      orderKeys.recipeInventoryStockRoot(),
      orderKeys.inventoryDataQuality(companyId),
      ...(companyId ? [orderKeys.products(companyId)] : []),
    ],
    showErrorToast: false,
  });
}

export function useCancelOrderMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (id: string) => cancelOrder(id, companyId),
    invalidateQueries: [
      orderKeys.listRoot(),
      orderKeys.summaryRoot(),
      orderKeys.rangeSummaryRoot(),
      orderKeys.recipeInventoryStockRoot(),
      orderKeys.inventoryDataQuality(companyId),
    ],
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
  const normalizedStartDate = toYmd(startDate);
  const normalizedEndDate = toYmd(endDate);
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  const hasValidRange = datePattern.test(normalizedStartDate)
    && datePattern.test(normalizedEndDate)
    && normalizedStartDate <= normalizedEndDate;
  return useApiQuery<OrderItemsReportResult>({
    queryKey: orderKeys.itemsReportRange(companyId, normalizedStartDate, normalizedEndDate),
    queryFn: () => getOrdersItemsReportRange(companyId, normalizedStartDate, normalizedEndDate),
    fallbackMessage: 'Failed to load orders items report range',
    enabled: !!companyId && hasValidRange,
  });
}

export function useOrdersRecipeInventoryStock(companyId: string) {
  return useApiListQuery<OrderRecipeInventoryStockRow>({
    queryKey: orderKeys.recipeInventoryStock(companyId),
    queryFn: () => getOrdersRecipeInventoryStock(companyId),
    fallbackMessage: 'Failed to load recipe inventory stock',
    enabled: !!companyId,
  });
}

export function useInventoryDataQuality(companyId: string) {
  return useApiQuery<InventoryDataQualityReport>({
    queryKey: orderKeys.inventoryDataQuality(companyId),
    queryFn: () => getInventoryDataQuality(companyId),
    fallbackMessage: 'Failed to load inventory data quality',
    enabled: !!companyId,
  });
}

export function useInventoryStocktakes(companyId: string) {
  return useApiListQuery<InventoryStocktake>({
    queryKey: orderKeys.inventoryStocktakes(companyId),
    queryFn: () => getInventoryStocktakes(companyId),
    fallbackMessage: 'تعذر تحميل سجل الجرد',
    enabled: !!companyId,
  });
}

export function useCreateInventoryStocktakeMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (body: Omit<CreateInventoryStocktakePayload, 'companyId'>) => (
      createInventoryStocktake({ ...body, companyId })
    ),
    invalidateQueries: [
      orderKeys.recipeInventoryStock(companyId),
      orderKeys.inventoryStocktakes(companyId),
    ],
    successToast: 'تم اعتماد الجرد وتسجيل الفروقات',
  });
}

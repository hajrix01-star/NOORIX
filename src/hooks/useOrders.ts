import { useMemo } from 'react';
import { useApiMutation } from './useApiMutation';
import { useApiListQuery, useApiQueries, useApiQuery, useApiQueryOr } from './useApiQuery';
import {
  bulkSetProductSections,
  cancelOrder,
  createOrder,
  createOrderCategoriesBatch,
  createOrderCategory,
  createOrderProduct,
  createOrderProductsBatch,
  createOrderSection,
  createStaffOrder,
  deleteOrderSection,
  deleteStaffOrder,
  deactivateOrderCategoriesBulk,
  deactivateOrderProductsBulk,
  getCategoryPurchaseHistory,
  getDigestHistory,
  getMyStaffOrders,
  getOrderCategories,
  getOrderProducts,
  getOrders,
  getOrdersItemsReport,
  getOrdersRangeSummary,
  getOrdersSummary,
  getOrderSections,
  getProductPurchaseHistory,
  getSalesReport,
  getStaffDigest,
  getStaffSaleNextLogRef,
  resendStaffSale,
  sendStaffDigest,
  updateOrder,
  updateOrderCategory,
  updateOrderProduct,
  updateStaffOrder,
  getShishaInventorySummary,
  initializeShishaInventory,
  createShishaInventoryPurchase,
  createShishaInventoryStocktake,
} from '../services/api';
import { orderKeys } from '../services/queryKeys';
import { listYearMonthsInRange } from '../utils/datePeriod';
import type {
  CreateOrderPayload,
  DigestHistoryDay,
  OrderCategory,
  OrderCategoryPayload,
  OrderItemsReportRow,
  OrderProduct,
  OrderProductPayload,
  OrderPurchaseHistoryRow,
  OrderRangeSummary,
  OrderRecord,
  OrderSection,
  OrderSectionPayload,
  OrderSummary,
  StaffDigestData,
  StaffDigestSendResult,
  StaffOrder,
  StaffOrderPayload,
  StaffSaleNextLogRef,
  StaffSaleReport,
  UpdateOrderPayload,
  ShishaInventorySummary,
  InitializeShishaInventoryPayload,
  CreateShishaPurchasePayload,
  CreateShishaStocktakePayload,
} from '../types/api';

type MutationArgs<TBody> = { id: string; body: TBody };

const emptyOrderSummary: OrderSummary = {
  pettyCashTotal: 0,
  delegatePurchasesTotal: 0,
  localPurchasesTotal: 0,
  delegateBalance: 0,
};

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

function reportKey(row: OrderItemsReportRow): string {
  return [
    row.productId,
    row.categoryId ?? row.categoryNameAr ?? row.categoryNameEn ?? '',
    row.unit ?? '',
  ].join('|');
}

function mergeOrderItemsReports(reports: OrderItemsReportRow[][]): OrderItemsReportRow[] {
  const byKey = new Map<string, OrderItemsReportRow>();
  for (const report of reports) {
    for (const row of report) {
      const key = reportKey(row);
      const current = byKey.get(key);
      if (!current) {
        byKey.set(key, { ...row });
        continue;
      }
      current.quantity = Number(current.quantity ?? 0) + Number(row.quantity ?? 0);
      current.amount = Number(current.amount ?? 0) + Number(row.amount ?? 0);
      current.orderCount = Number(current.orderCount ?? 0) + Number(row.orderCount ?? 0);
    }
  }
  return Array.from(byKey.values());
}

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

export function useOrderProducts(companyId: string, type?: string) {
  return useApiListQuery<OrderProduct>({
    queryKey: [...orderKeys.products(companyId), type],
    queryFn: () => getOrderProducts(companyId, undefined, type),
    fallbackMessage: 'Failed to load order products',
    enabled: !!companyId,
  });
}

export function useOrderCategories(companyId: string) {
  return useApiListQuery<OrderCategory>({
    queryKey: orderKeys.categories(companyId),
    queryFn: () => getOrderCategories(companyId),
    fallbackMessage: 'Failed to load order categories',
    enabled: !!companyId,
  });
}

export function useProductPurchaseHistory(
  companyId: string,
  productId: string,
  year: string | number,
  month: string | number,
  enabled = true,
) {
  return useApiListQuery<OrderPurchaseHistoryRow>({
    queryKey: orderKeys.productPurchaseHistory(companyId, productId, year, month),
    queryFn: () => getProductPurchaseHistory(companyId, productId, year, month),
    fallbackMessage: 'Failed to load product purchase history',
    enabled: !!companyId && !!productId && enabled,
  });
}

export function useCategoryPurchaseHistory(
  companyId: string,
  categoryId: string,
  year: string | number,
  month: string | number,
  enabled = true,
) {
  return useApiListQuery<OrderPurchaseHistoryRow>({
    queryKey: orderKeys.categoryPurchaseHistory(companyId, categoryId, year, month),
    queryFn: () => getCategoryPurchaseHistory(companyId, categoryId, year, month),
    fallbackMessage: 'Failed to load category purchase history',
    enabled: !!companyId && !!categoryId && enabled,
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
  const months = useMemo(() => listYearMonthsInRange(startDate, endDate), [startDate, endDate]);
  const results = useApiQueries({
    queries: months.map(({ year, month }) => ({
      queryKey: orderKeys.itemsReport(companyId, year, month),
      queryFn: () => getOrdersItemsReport(companyId, year, month),
      fallbackMessage: 'Failed to load orders items report',
      enabled: !!companyId && months.length > 0,
    })),
  });

  const data = useMemo(
    () => mergeOrderItemsReports(results.map((result) => (Array.isArray(result.data) ? result.data as OrderItemsReportRow[] : []))),
    [results],
  );

  return {
    data,
    isLoading: results.some((result) => result.isLoading),
    error: results.find((result) => result.error)?.error as Error | null | undefined,
  };
}

export function useCreateOrderProductMutation(companyId: string) {
  return useApiMutation({
    mutationFn: createOrderProduct,
    invalidateQueries: [orderKeys.products(companyId)],
    showErrorToast: false,
  });
}

export function useCreateOrderProductsBatchMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (products: OrderProductPayload[]) => createOrderProductsBatch(companyId, products),
    invalidateQueries: [orderKeys.products(companyId)],
    showErrorToast: false,
  });
}

export function useCreateOrderCategoriesBatchMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (categories: OrderCategoryPayload[]) => createOrderCategoriesBatch(companyId, categories),
    invalidateQueries: [orderKeys.categories(companyId)],
    showErrorToast: false,
  });
}

export function useUpdateOrderProductMutation(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, body }: MutationArgs<Partial<OrderProductPayload>>) => updateOrderProduct(id, body, companyId),
    invalidateQueries: [orderKeys.products(companyId)],
    showErrorToast: false,
  });
}

export function useCreateOrderCategoryMutation(companyId: string) {
  return useApiMutation({
    mutationFn: createOrderCategory,
    invalidateQueries: [orderKeys.categories(companyId)],
    showErrorToast: false,
  });
}

export function useUpdateOrderCategoryMutation(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, body }: MutationArgs<Partial<OrderCategoryPayload>>) => updateOrderCategory(id, body, companyId),
    invalidateQueries: [orderKeys.categories(companyId)],
    showErrorToast: false,
  });
}

export function useDeleteOrderProductsMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (ids: string[]) => deactivateOrderProductsBulk(companyId, ids),
    invalidateQueries: [orderKeys.products(companyId)],
    showErrorToast: false,
  });
}

export function useDeleteOrderCategoriesMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (ids: string[]) => deactivateOrderCategoriesBulk(companyId, ids),
    invalidateQueries: [orderKeys.categories(companyId)],
    showErrorToast: false,
  });
}

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

export function useShishaInventory(companyId: string, startDate: string, endDate: string) {
  return useApiQuery<ShishaInventorySummary>({
    queryKey: orderKeys.shishaInventory(companyId, startDate, endDate),
    queryFn: () => getShishaInventorySummary(companyId, startDate, endDate),
    fallbackMessage: 'Failed to load shisha inventory',
    enabled: !!companyId && !!startDate && !!endDate,
  });
}

export function useInitializeShishaInventoryMutation() {
  return useApiMutation({
    mutationFn: (body: InitializeShishaInventoryPayload) => initializeShishaInventory(body),
    invalidateQueries: [orderKeys.shishaInventoryRoot()],
    successToast: 'تم تسجيل مخزون البداية بنجاح',
  });
}

export function useCreateShishaPurchaseMutation() {
  return useApiMutation({
    mutationFn: (body: CreateShishaPurchasePayload) => createShishaInventoryPurchase(body),
    invalidateQueries: [orderKeys.shishaInventoryRoot()],
    successToast: 'تم تسجيل حركة الشراء بنجاح',
  });
}

export function useCreateShishaStocktakeMutation() {
  return useApiMutation({
    mutationFn: (body: CreateShishaStocktakePayload) => createShishaInventoryStocktake(body),
    invalidateQueries: [orderKeys.shishaInventoryRoot()],
    successToast: 'تم اعتماد الجرد وتسجيل فروقات التصحيح',
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

export function useOrderSections(companyId: string) {
  return useApiListQuery<OrderSection>({
    queryKey: ['orderSections', companyId],
    queryFn: () => getOrderSections(companyId),
    fallbackMessage: 'Failed to load order sections',
    enabled: !!companyId,
  });
}

export function useCreateOrderSectionMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (body: OrderSectionPayload & { companyId: string }) => createOrderSection(body),
    invalidateQueries: [['orderSections', companyId]],
    showErrorToast: false,
  });
}

export function useDeleteOrderSectionMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (id: string) => deleteOrderSection(id, companyId),
    invalidateQueries: [['orderSections', companyId]],
    showErrorToast: false,
  });
}

export function useBulkSetProductSectionsMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (body: { productIds: string[]; sectionNames?: string[]; sectionIds?: string[]; mode?: 'replace' | 'add' }) =>
      bulkSetProductSections(companyId, body.productIds, {
        sectionNames: body.sectionNames,
        sectionIds: body.sectionIds,
        mode: body.mode,
      }),
    invalidateQueries: [orderKeys.products(companyId)],
    showErrorToast: false,
  });
}

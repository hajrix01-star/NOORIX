import { useApiMutation } from './useApiMutation';
import { useApiListQuery, useApiQuery, useApiQueryOr } from './useApiQuery';
import {
  getOrders,
  createOrder,
  updateOrder,
  cancelOrder,
  getOrdersSummary,
  getOrdersItemsReport,
  getProductPurchaseHistory,
  getCategoryPurchaseHistory,
  getOrderProducts,
  createOrderProduct,
  updateOrderProduct,
  createOrderProductsBatch,
  getOrderCategories,
  createOrderCategory,
  updateOrderCategory,
  createOrderCategoriesBatch,
  deactivateOrderProductsBulk,
  deactivateOrderCategoriesBulk,
  getMyStaffOrders,
  getStaffSaleNextLogRef,
  createStaffOrder,
  updateStaffOrder,
  deleteStaffOrder,
  resendStaffSale,
  getStaffDigest,
  getDigestHistory,
  getSalesReport,
  sendStaffDigest,
  getOrderSections,
  createOrderSection,
  deleteOrderSection,
  bulkSetProductSections,
} from '../services/api';
import { orderKeys } from '../services/queryKeys';

export function useOrders(companyId: any, year: any, month: any) {
  return useApiListQuery<any>({
    queryKey: orderKeys.list(companyId, year, month),
    queryFn: () => getOrders(companyId, year, month),
    fallbackMessage: 'Failed to load orders',
    enabled: !!companyId && !!year && !!month,
  });
}

export function useCreateOrderMutation(companyId?: string) {
  return useApiMutation({
    mutationFn: createOrder,
    invalidateQueries: [
      orderKeys.listRoot(),
      orderKeys.summaryRoot(),
      ...(companyId ? [orderKeys.products(companyId)] : [orderKeys.productsRoot()]),
    ],
    showErrorToast: false,
  });
}

export function useUpdateOrderMutation(companyId: any) {
  return useApiMutation({
    mutationFn: ({ id, body }: any) => updateOrder(id, body, companyId),
    invalidateQueries: [
      orderKeys.listRoot(),
      orderKeys.summaryRoot(),
      ...(companyId ? [orderKeys.products(companyId)] : []),
    ],
    showErrorToast: false,
  });
}

export function useCancelOrderMutation(companyId: any) {
  return useApiMutation({
    mutationFn: (id: any) => cancelOrder(id, companyId),
    invalidateQueries: [orderKeys.listRoot(), orderKeys.summaryRoot()],
    showErrorToast: false,
  });
}

export function useOrdersSummary(companyId: any, year: any, month: any) {
  return useApiQueryOr<Record<string, unknown>>({
    queryKey: orderKeys.summary(companyId, year, month),
    queryFn: () => getOrdersSummary(companyId, year, month),
    fallback: {},
    fallbackMessage: 'Failed to load orders summary',
    enabled: !!companyId && !!year && !!month,
  });
}

export function useOrderProducts(companyId: any, type?: string) {
  return useApiListQuery<any>({
    queryKey: [...orderKeys.products(companyId), type],
    queryFn: () => getOrderProducts(companyId, undefined, type),
    fallbackMessage: 'Failed to load order products',
    enabled: !!companyId,
  });
}

export function useOrderCategories(companyId: any) {
  return useApiListQuery<any>({
    queryKey: orderKeys.categories(companyId),
    queryFn: () => getOrderCategories(companyId),
    fallbackMessage: 'Failed to load order categories',
    enabled: !!companyId,
  });
}

export function useProductPurchaseHistory(companyId: any, productId: any, year: any, month: any, enabled: any = true) {
  return useApiListQuery<any>({
    queryKey: orderKeys.productPurchaseHistory(companyId, productId, year, month),
    queryFn: () => getProductPurchaseHistory(companyId, productId, year, month),
    fallbackMessage: 'Failed to load product purchase history',
    enabled: !!companyId && !!productId && enabled,
  });
}

export function useCategoryPurchaseHistory(companyId: any, categoryId: any, year: any, month: any, enabled: any = true) {
  return useApiListQuery<any>({
    queryKey: orderKeys.categoryPurchaseHistory(companyId, categoryId, year, month),
    queryFn: () => getCategoryPurchaseHistory(companyId, categoryId, year, month),
    fallbackMessage: 'Failed to load category purchase history',
    enabled: !!companyId && !!categoryId && enabled,
  });
}

export function useOrdersItemsReport(companyId: any, year: any, month: any) {
  return useApiListQuery<any>({
    queryKey: orderKeys.itemsReport(companyId, year, month),
    queryFn: () => getOrdersItemsReport(companyId, year, month),
    fallbackMessage: 'Failed to load orders items report',
    enabled: !!companyId && !!year && !!month,
  });
}

export function useCreateOrderProductMutation(companyId: any) {
  return useApiMutation({
    mutationFn: createOrderProduct,
    invalidateQueries: [orderKeys.products(companyId)],
    showErrorToast: false,
  });
}

export function useCreateOrderProductsBatchMutation(companyId: any) {
  return useApiMutation({
    mutationFn: (products: any) => createOrderProductsBatch(companyId, products),
    invalidateQueries: [orderKeys.products(companyId)],
    showErrorToast: false,
  });
}

export function useCreateOrderCategoriesBatchMutation(companyId: any) {
  return useApiMutation({
    mutationFn: (categories: any) => createOrderCategoriesBatch(companyId, categories),
    invalidateQueries: [orderKeys.categories(companyId)],
    showErrorToast: false,
  });
}

export function useUpdateOrderProductMutation(companyId: any) {
  return useApiMutation({
    mutationFn: ({ id, body }: any) => updateOrderProduct(id, body, companyId),
    invalidateQueries: [orderKeys.products(companyId)],
    showErrorToast: false,
  });
}

export function useCreateOrderCategoryMutation(companyId: any) {
  return useApiMutation({
    mutationFn: createOrderCategory,
    invalidateQueries: [orderKeys.categories(companyId)],
    showErrorToast: false,
  });
}

export function useUpdateOrderCategoryMutation(companyId: any) {
  return useApiMutation({
    mutationFn: ({ id, body }: any) => updateOrderCategory(id, body, companyId),
    invalidateQueries: [orderKeys.categories(companyId)],
    showErrorToast: false,
  });
}

export function useDeleteOrderProductsMutation(companyId: any) {
  return useApiMutation({
    mutationFn: (ids: string[]) => deactivateOrderProductsBulk(companyId, ids),
    invalidateQueries: [orderKeys.products(companyId)],
    showErrorToast: false,
  });
}

export function useDeleteOrderCategoriesMutation(companyId: any) {
  return useApiMutation({
    mutationFn: (ids: string[]) => deactivateOrderCategoriesBulk(companyId, ids),
    invalidateQueries: [orderKeys.categories(companyId)],
    showErrorToast: false,
  });
}

export function useMyStaffOrders(companyId: any) {
  return useApiListQuery<any>({
    queryKey: orderKeys.staffMy(companyId),
    queryFn: () => getMyStaffOrders(companyId),
    fallbackMessage: 'Failed to load staff orders',
    enabled: !!companyId,
  });
}

export function useStaffSaleNextLogRef(companyId: any, saleDate: string, enabled = true) {
  return useApiQuery<{ logRef?: string }, string>({
    queryKey: ['staffSaleNextLogRef', companyId, saleDate],
    queryFn: () => getStaffSaleNextLogRef(companyId, saleDate),
    fallbackMessage: 'Failed to load next staff sale reference',
    enabled: !!companyId && !!saleDate && enabled,
    staleTime: 15_000,
    select: (data) => String(data?.logRef ?? ''),
  });
}

export function useCreateStaffOrderMutation(companyId: any) {
  return useApiMutation({
    mutationFn: createStaffOrder,
    invalidateQueries: [
      orderKeys.staffMy(companyId),
      orderKeys.staffDigest(companyId),
      ['salesReport', companyId],
      ['staffSaleNextLogRef', companyId],
    ],
    showErrorToast: false,
  });
}

export function useUpdateStaffOrderMutation(companyId: any) {
  return useApiMutation({
    mutationFn: ({ id, body }: any) => updateStaffOrder(id, companyId, body),
    invalidateQueries: [
      orderKeys.staffMy(companyId),
      orderKeys.staffDigest(companyId),
      ['salesReport', companyId],
    ],
    showErrorToast: false,
  });
}

export function useDeleteStaffOrderMutation(companyId: any) {
  return useApiMutation({
    mutationFn: (id: string) => deleteStaffOrder(id, companyId),
    invalidateQueries: [
      orderKeys.staffMy(companyId),
      orderKeys.staffDigest(companyId),
      ['salesReport', companyId],
    ],
    showErrorToast: false,
  });
}

export function useResendStaffSaleMutation(companyId: any) {
  return useApiMutation({
    mutationFn: ({ id, lang }: { id: string; lang?: 'ar' | 'en' }) =>
      resendStaffSale(id, companyId, lang),
    invalidateQueries: [orderKeys.staffMy(companyId)],
    showErrorToast: false,
  });
}

export function useStaffDigest(companyId: any) {
  return useApiQueryOr<any>({
    queryKey: orderKeys.staffDigest(companyId),
    queryFn: () => getStaffDigest(companyId),
    fallback: { sections: [], totalOrders: 0, pendingCount: 0 },
    fallbackMessage: 'Failed to load staff digest',
    enabled: !!companyId,
  });
}

export function useSalesReport(companyId: any, days = 30) {
  return useApiQueryOr<Record<string, unknown>>({
    queryKey: ['salesReport', companyId, days],
    queryFn: () => getSalesReport(companyId, days),
    fallback: {},
    fallbackMessage: 'Failed to load sales report',
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function useDigestHistory(companyId: any, days = 30) {
  return useApiListQuery<any>({
    queryKey: ['digestHistory', companyId, days],
    queryFn: () => getDigestHistory(companyId, days),
    fallbackMessage: 'Failed to load digest history',
    enabled: !!companyId,
    staleTime: 60_000,
  });
}

export function useSendStaffDigestMutation(companyId: any) {
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
    ],
    showErrorToast: false,
  });
}

export function useOrderSections(companyId: any) {
  return useApiListQuery<any>({
    queryKey: ['orderSections', companyId],
    queryFn: () => getOrderSections(companyId),
    fallbackMessage: 'Failed to load order sections',
    enabled: !!companyId,
  });
}

export function useCreateOrderSectionMutation(companyId: any) {
  return useApiMutation({
    mutationFn: (body: unknown) => createOrderSection(body),
    invalidateQueries: [['orderSections', companyId]],
    showErrorToast: false,
  });
}

export function useDeleteOrderSectionMutation(companyId: any) {
  return useApiMutation({
    mutationFn: (id: string) => deleteOrderSection(id, companyId),
    invalidateQueries: [['orderSections', companyId]],
    showErrorToast: false,
  });
}

export function useBulkSetProductSectionsMutation(companyId: any) {
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

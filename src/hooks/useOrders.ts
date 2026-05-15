/**
 * useOrders — جلب الطلبات والمنتجات والفئات
 */
import { useQuery } from '@tanstack/react-query';
import { useApiMutation } from './useApiMutation';
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
  getStaffMyOrders,
  createStaffOrder,
  updateStaffOrder,
  cancelStaffOrder,
  markStaffOrdersDigestSent,
  throwIfApiFailed,
} from '../services/api';
import { orderKeys } from '../services/queryKeys';

export function useOrders(companyId: any, year: any, month: any) {
  return useQuery({
    queryKey: orderKeys.list(companyId, year, month),
    queryFn: async () => {
      const res = await getOrders(companyId, year, month);
      throwIfApiFailed(res, 'فشل تحميل الطلبات');
      return res.data ?? [];
    },
    enabled: !!companyId && !!year && !!month,
  });
}

export function useCreateOrderMutation() {
  return useApiMutation({
    mutationFn: createOrder,
    invalidateQueries: [orderKeys.listRoot(), orderKeys.summaryRoot()],
    showErrorToast: false,
  });
}

export function useUpdateOrderMutation(companyId: any) {
  return useApiMutation({
    mutationFn: ({ id, body }: any) => updateOrder(id, body, companyId),
    invalidateQueries: [orderKeys.listRoot(), orderKeys.summaryRoot()],
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
  return useQuery({
    queryKey: orderKeys.summary(companyId, year, month),
    queryFn: async () => {
      const res = await getOrdersSummary(companyId, year, month);
      if (!res?.success) return {};
      return res.data ?? {};
    },
    enabled: !!companyId && !!year && !!month,
  });
}

export function useOrderProducts(companyId: any) {
  return useQuery({
    queryKey: orderKeys.products(companyId),
    queryFn: async () => {
      const res = await getOrderProducts(companyId);
      throwIfApiFailed(res, 'فشل تحميل الأصناف');
      return res.data ?? [];
    },
    enabled: !!companyId,
  });
}

export function useOrderCategories(companyId: any) {
  return useQuery({
    queryKey: orderKeys.categories(companyId),
    queryFn: async () => {
      const res = await getOrderCategories(companyId);
      throwIfApiFailed(res, 'فشل تحميل الفئات');
      return res.data ?? [];
    },
    enabled: !!companyId,
  });
}

export function useProductPurchaseHistory(companyId: any, productId: any, year: any, month: any, enabled: any = true) {
  return useQuery({
    queryKey: orderKeys.productPurchaseHistory(companyId, productId, year, month),
    queryFn: async () => {
      const res = await getProductPurchaseHistory(companyId, productId, year, month);
      if (!res?.success) return [];
      return res.data ?? [];
    },
    enabled: !!companyId && !!productId && enabled,
  });
}

export function useCategoryPurchaseHistory(companyId: any, categoryId: any, year: any, month: any, enabled: any = true) {
  return useQuery({
    queryKey: orderKeys.categoryPurchaseHistory(companyId, categoryId, year, month),
    queryFn: async () => {
      const res = await getCategoryPurchaseHistory(companyId, categoryId, year, month);
      if (!res?.success) return [];
      return res.data ?? [];
    },
    enabled: !!companyId && !!categoryId && enabled,
  });
}

export function useOrdersItemsReport(companyId: any, year: any, month: any) {
  return useQuery({
    queryKey: orderKeys.itemsReport(companyId, year, month),
    queryFn: async () => {
      const res = await getOrdersItemsReport(companyId, year, month);
      throwIfApiFailed(res, 'فشل تحميل التقرير');
      return res.data ?? [];
    },
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

export function useStaffMyOrders(companyId: any, year: any, month: any) {
  return useQuery({
    queryKey: orderKeys.staffMine(companyId, year, month),
    queryFn: async () => {
      const res = await getStaffMyOrders(companyId, year, month);
      throwIfApiFailed(res, 'فشل تحميل طلباتك');
      return res.data ?? [];
    },
    enabled: !!companyId && !!year && !!month,
  });
}

export function useCreateStaffOrderMutation() {
  return useApiMutation({
    mutationFn: createStaffOrder,
    invalidateQueries: [orderKeys.staffMineRoot(), orderKeys.listRoot(), orderKeys.summaryRoot()],
    showErrorToast: false,
  });
}

export function useUpdateStaffOrderMutation(companyId: any) {
  return useApiMutation({
    mutationFn: ({ id, body }: any) => updateStaffOrder(id, body, companyId),
    invalidateQueries: [orderKeys.staffMineRoot(), orderKeys.listRoot(), orderKeys.summaryRoot()],
    showErrorToast: false,
  });
}

export function useCancelStaffOrderMutation(companyId: any) {
  return useApiMutation({
    mutationFn: (id: any) => cancelStaffOrder(id, companyId),
    invalidateQueries: [orderKeys.staffMineRoot(), orderKeys.listRoot(), orderKeys.summaryRoot()],
    showErrorToast: false,
  });
}

export function useMarkStaffDigestSentMutation() {
  return useApiMutation({
    mutationFn: markStaffOrdersDigestSent,
    invalidateQueries: [orderKeys.listRoot(), orderKeys.summaryRoot(), orderKeys.itemsReportRoot()],
    showErrorToast: false,
  });
}

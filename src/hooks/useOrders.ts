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
  throwIfApiFailed,
} from '../services/api';

export function useOrders(companyId: any, year: any, month: any) {
  return useQuery({
    queryKey: ['orders', companyId, year, month],
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
    invalidateQueries: [
      { predicate: (q: any) => q.queryKey[0] === 'orders' },
      { predicate: (q: any) => q.queryKey[0] === 'orders-summary' },
    ],
    showErrorToast: false,
  });
}

export function useUpdateOrderMutation(companyId: any) {
  return useApiMutation({
    mutationFn: ({ id, body }: any) => updateOrder(id, body, companyId),
    invalidateQueries: [
      { predicate: (q: any) => q.queryKey[0] === 'orders' },
      { predicate: (q: any) => q.queryKey[0] === 'orders-summary' },
    ],
    showErrorToast: false,
  });
}

export function useCancelOrderMutation(companyId: any) {
  return useApiMutation({
    mutationFn: (id: any) => cancelOrder(id, companyId),
    invalidateQueries: [
      { predicate: (q: any) => q.queryKey[0] === 'orders' },
      { predicate: (q: any) => q.queryKey[0] === 'orders-summary' },
    ],
    showErrorToast: false,
  });
}

export function useOrdersSummary(companyId: any, year: any, month: any) {
  return useQuery({
    queryKey: ['orders-summary', companyId, year, month],
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
    queryKey: ['order-products', companyId],
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
    queryKey: ['order-categories', companyId],
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
    queryKey: ['product-purchase-history', companyId, productId, year, month],
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
    queryKey: ['category-purchase-history', companyId, categoryId, year, month],
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
    queryKey: ['orders-items-report', companyId, year, month],
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
    invalidateQueries: [['order-products', companyId]],
    showErrorToast: false,
  });
}

export function useCreateOrderProductsBatchMutation(companyId: any) {
  return useApiMutation({
    mutationFn: (products: any) => createOrderProductsBatch(companyId, products),
    invalidateQueries: [['order-products', companyId]],
    showErrorToast: false,
  });
}

export function useCreateOrderCategoriesBatchMutation(companyId: any) {
  return useApiMutation({
    mutationFn: (categories: any) => createOrderCategoriesBatch(companyId, categories),
    invalidateQueries: [['order-categories', companyId]],
    showErrorToast: false,
  });
}

export function useUpdateOrderProductMutation(companyId: any) {
  return useApiMutation({
    mutationFn: ({ id, body }: any) => updateOrderProduct(id, body, companyId),
    invalidateQueries: [['order-products', companyId]],
    showErrorToast: false,
  });
}

export function useCreateOrderCategoryMutation(companyId: any) {
  return useApiMutation({
    mutationFn: createOrderCategory,
    invalidateQueries: [['order-categories', companyId]],
    showErrorToast: false,
  });
}

export function useUpdateOrderCategoryMutation(companyId: any) {
  return useApiMutation({
    mutationFn: ({ id, body }: any) => updateOrderCategory(id, body, companyId),
    invalidateQueries: [['order-categories', companyId]],
    showErrorToast: false,
  });
}

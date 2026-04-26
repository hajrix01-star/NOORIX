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

export function useOrders(companyId, year, month) {
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
      { predicate: (q) => q.queryKey[0] === 'orders' },
      { predicate: (q) => q.queryKey[0] === 'orders-summary' },
    ],
    showErrorToast: false,
  });
}

export function useUpdateOrderMutation(companyId) {
  return useApiMutation({
    mutationFn: ({ id, body }) => updateOrder(id, body, companyId),
    invalidateQueries: [
      { predicate: (q) => q.queryKey[0] === 'orders' },
      { predicate: (q) => q.queryKey[0] === 'orders-summary' },
    ],
    showErrorToast: false,
  });
}

export function useCancelOrderMutation(companyId) {
  return useApiMutation({
    mutationFn: (id) => cancelOrder(id, companyId),
    invalidateQueries: [
      { predicate: (q) => q.queryKey[0] === 'orders' },
      { predicate: (q) => q.queryKey[0] === 'orders-summary' },
    ],
    showErrorToast: false,
  });
}

export function useOrdersSummary(companyId, year, month) {
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

export function useOrderProducts(companyId) {
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

export function useOrderCategories(companyId) {
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

export function useProductPurchaseHistory(companyId, productId, year, month, enabled = true) {
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

export function useCategoryPurchaseHistory(companyId, categoryId, year, month, enabled = true) {
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

export function useOrdersItemsReport(companyId, year, month) {
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

export function useCreateOrderProductMutation(companyId) {
  return useApiMutation({
    mutationFn: createOrderProduct,
    invalidateQueries: [['order-products', companyId]],
    showErrorToast: false,
  });
}

export function useCreateOrderProductsBatchMutation(companyId) {
  return useApiMutation({
    mutationFn: (products) => createOrderProductsBatch(companyId, products),
    invalidateQueries: [['order-products', companyId]],
    showErrorToast: false,
  });
}

export function useCreateOrderCategoriesBatchMutation(companyId) {
  return useApiMutation({
    mutationFn: (categories) => createOrderCategoriesBatch(companyId, categories),
    invalidateQueries: [['order-categories', companyId]],
    showErrorToast: false,
  });
}

export function useUpdateOrderProductMutation(companyId) {
  return useApiMutation({
    mutationFn: ({ id, body }) => updateOrderProduct(id, body, companyId),
    invalidateQueries: [['order-products', companyId]],
    showErrorToast: false,
  });
}

export function useCreateOrderCategoryMutation(companyId) {
  return useApiMutation({
    mutationFn: createOrderCategory,
    invalidateQueries: [['order-categories', companyId]],
    showErrorToast: false,
  });
}

export function useUpdateOrderCategoryMutation(companyId) {
  return useApiMutation({
    mutationFn: ({ id, body }) => updateOrderCategory(id, body, companyId),
    invalidateQueries: [['order-categories', companyId]],
    showErrorToast: false,
  });
}

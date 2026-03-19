/**
 * useOrders — جلب الطلبات والمنتجات والفئات
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getOrders,
  getOrder,
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
  getOrderCategories,
  createOrderCategory,
  updateOrderCategory,
} from '../services/api';

export function useOrders(companyId, year, month) {
  return useQuery({
    queryKey: ['orders', companyId, year, month],
    queryFn: async () => {
      const res = await getOrders(companyId, year, month);
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل الطلبات');
      return res.data ?? [];
    },
    enabled: !!companyId && !!year && !!month,
  });
}

export function useOrder(id, companyId, enabled = true) {
  return useQuery({
    queryKey: ['orders', id, companyId],
    queryFn: async () => {
      const res = await getOrder(id, companyId);
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل الطلب');
      return res.data;
    },
    enabled: !!id && !!companyId && enabled,
  });
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrder,
    onSuccess: (_, variables) => {
      // إبطال جميع استعلامات الطلبات والملخص (بما فيها year/month) لضمان ظهور الطلب الجديد
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'orders' });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'orders-summary' });
    },
  });
}

export function useUpdateOrderMutation(companyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateOrder(id, body, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'orders' });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'orders-summary' });
    },
  });
}

export function useCancelOrderMutation(companyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => cancelOrder(id, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'orders' });
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'orders-summary' });
    },
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
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل الأصناف');
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
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل الفئات');
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
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل التقرير');
      return res.data ?? [];
    },
    enabled: !!companyId && !!year && !!month,
  });
}

export function useCreateOrderProductMutation(companyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrderProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-products', companyId] });
    },
  });
}

export function useCreateOrderProductsBatchMutation(companyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (products) => createOrderProductsBatch(companyId, products),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-products', companyId] });
    },
  });
}

export function useCreateOrderCategoriesBatchMutation(companyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categories) => createOrderCategoriesBatch(companyId, categories),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-categories', companyId] });
    },
  });
}

export function useUpdateOrderProductMutation(companyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateOrderProduct(id, body, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-products', companyId] });
    },
  });
}

export function useCreateOrderCategoryMutation(companyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOrderCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-categories', companyId] });
    },
  });
}

export function useUpdateOrderCategoryMutation(companyId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }) => updateOrderCategory(id, body, companyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-categories', companyId] });
    },
  });
}

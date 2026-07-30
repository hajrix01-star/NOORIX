import {
  createOrderCategoriesBatch,
  createOrderCategory,
  createOrderProduct,
  createOrderProductsBatch,
  deactivateOrderCategoriesBulk,
  deactivateOrderProductsBulk,
  getCategoryPurchaseHistory,
  getOrderCategories,
  getOrderProducts,
  getProductPurchaseHistory,
  updateOrderCategory,
  updateOrderProduct,
} from '../../services/api';
import { orderKeys } from '../../services/queryKeys';
import type {
  OrderCategory,
  OrderCategoryPayload,
  OrderProduct,
  OrderProductPayload,
  OrderPurchaseHistoryRow,
} from '../../types/api';
import { useApiMutation } from '../useApiMutation';
import { useApiListQuery } from '../useApiQuery';

type MutationArgs<TBody> = { id: string; body: TBody };

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

export function useProductPurchaseHistoryRange(
  companyId: string,
  productId: string,
  startDate: string,
  endDate: string,
  enabled = true,
) {
  return useApiListQuery<OrderPurchaseHistoryRow>({
    queryKey: [...orderKeys.productPurchaseHistory(companyId, productId, startDate, endDate), 'range'],
    queryFn: () => getProductPurchaseHistory(companyId, productId, undefined, undefined, startDate, endDate),
    fallbackMessage: 'Failed to load product purchase history range',
    enabled: !!companyId && !!productId && !!startDate && !!endDate && enabled,
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

export function useCategoryPurchaseHistoryRange(
  companyId: string,
  categoryId: string,
  startDate: string,
  endDate: string,
  enabled = true,
) {
  return useApiListQuery<OrderPurchaseHistoryRow>({
    queryKey: [...orderKeys.categoryPurchaseHistory(companyId, categoryId, startDate, endDate), 'range'],
    queryFn: () => getCategoryPurchaseHistory(companyId, categoryId, undefined, undefined, startDate, endDate),
    fallbackMessage: 'Failed to load category purchase history range',
    enabled: !!companyId && !!categoryId && !!startDate && !!endDate && enabled,
  });
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

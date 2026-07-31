import {
  applyOrderProductTranslations,
  applyOrderCategoryTranslations,
  createOrderCatalogUnit,
  createOrderCategoriesBatch,
  createOrderCategory,
  createOrderConversionTemplate,
  createOrderProduct,
  createOrderProductsBatch,
  deleteOrderCatalogUnit,
  deleteOrderConversionTemplate,
  deactivateOrderCategoriesBulk,
  deactivateOrderProductsBulk,
  getCategoryPurchaseHistory,
  getOrderCatalogUnits,
  getOrderCategories,
  getOrderConversionTemplates,
  getOrderProducts,
  getProductPurchaseHistory,
  previewOrderProductTranslations,
  previewOrderCategoryTranslations,
  updateOrderCatalogUnit,
  updateOrderCategory,
  updateOrderConversionTemplate,
  updateOrderProduct,
} from '../../services/api';
import { orderKeys } from '../../services/queryKeys';
import type {
  ApplyOrderProductTranslationItem,
  ApplyOrderCategoryTranslationItem,
  OrderCategory,
  OrderCategoryPayload,
  OrderCatalogUnit,
  OrderCatalogUnitPayload,
  OrderConversionTemplate,
  OrderConversionTemplatePayload,
  OrderProduct,
  OrderProductPayload,
  OrderProductType,
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

export function useOrderCatalogUnits(companyId: string) {
  return useApiListQuery<OrderCatalogUnit>({
    queryKey: orderKeys.catalogUnits(companyId),
    queryFn: () => getOrderCatalogUnits(companyId),
    fallbackMessage: 'Failed to load order catalog units',
    enabled: !!companyId,
  });
}

export function useOrderConversionTemplates(companyId: string) {
  return useApiListQuery<OrderConversionTemplate>({
    queryKey: orderKeys.conversionTemplates(companyId),
    queryFn: () => getOrderConversionTemplates(companyId),
    fallbackMessage: 'Failed to load order conversion templates',
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
    invalidateQueries: [orderKeys.products(companyId), orderKeys.recipeInventoryStockRoot()],
    showErrorToast: false,
  });
}

export function usePreviewOrderProductTranslationsMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (productType: OrderProductType) => previewOrderProductTranslations(companyId, productType),
    showErrorToast: true,
  });
}

export function useApplyOrderProductTranslationsMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (translations: ApplyOrderProductTranslationItem[]) =>
      applyOrderProductTranslations(companyId, translations),
    invalidateQueries: [orderKeys.products(companyId)],
    showErrorToast: true,
  });
}

export function usePreviewOrderCategoryTranslationsMutation(companyId: string) {
  return useApiMutation({
    mutationFn: () => previewOrderCategoryTranslations(companyId),
    showErrorToast: true,
  });
}

export function useApplyOrderCategoryTranslationsMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (translations: ApplyOrderCategoryTranslationItem[]) =>
      applyOrderCategoryTranslations(companyId, translations),
    invalidateQueries: [orderKeys.categories(companyId)],
    showErrorToast: true,
  });
}

export function useCreateOrderProductsBatchMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (products: OrderProductPayload[]) => createOrderProductsBatch(companyId, products),
    invalidateQueries: [orderKeys.products(companyId), orderKeys.recipeInventoryStockRoot()],
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
    invalidateQueries: [orderKeys.products(companyId), orderKeys.recipeInventoryStockRoot()],
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

export function useCreateOrderCatalogUnitMutation(companyId: string) {
  return useApiMutation({
    mutationFn: createOrderCatalogUnit,
    invalidateQueries: [orderKeys.catalogUnits(companyId), orderKeys.products(companyId), orderKeys.recipeInventoryStockRoot()],
    showErrorToast: false,
  });
}

export function useUpdateOrderCatalogUnitMutation(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, body }: MutationArgs<Partial<OrderCatalogUnitPayload>>) =>
      updateOrderCatalogUnit(id, body, companyId),
    invalidateQueries: [orderKeys.catalogUnits(companyId), orderKeys.products(companyId), orderKeys.recipeInventoryStockRoot()],
    showErrorToast: false,
  });
}

export function useDeleteOrderCatalogUnitMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (id: string) => deleteOrderCatalogUnit(id, companyId),
    invalidateQueries: [orderKeys.catalogUnits(companyId), orderKeys.products(companyId), orderKeys.recipeInventoryStockRoot()],
    showErrorToast: false,
  });
}

export function useCreateOrderConversionTemplateMutation(companyId: string) {
  return useApiMutation({
    mutationFn: createOrderConversionTemplate,
    invalidateQueries: [orderKeys.conversionTemplates(companyId), orderKeys.products(companyId), orderKeys.recipeInventoryStockRoot()],
    showErrorToast: false,
  });
}

export function useUpdateOrderConversionTemplateMutation(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, body }: MutationArgs<Partial<OrderConversionTemplatePayload>>) =>
      updateOrderConversionTemplate(id, body, companyId),
    invalidateQueries: [orderKeys.conversionTemplates(companyId), orderKeys.products(companyId), orderKeys.recipeInventoryStockRoot()],
    showErrorToast: false,
  });
}

export function useDeleteOrderConversionTemplateMutation(companyId: string) {
  return useApiMutation({
    mutationFn: (id: string) => deleteOrderConversionTemplate(id, companyId),
    invalidateQueries: [orderKeys.conversionTemplates(companyId), orderKeys.products(companyId), orderKeys.recipeInventoryStockRoot()],
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
    invalidateQueries: [orderKeys.products(companyId), orderKeys.recipeInventoryStockRoot()],
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

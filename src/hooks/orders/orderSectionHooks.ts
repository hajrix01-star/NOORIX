import {
  bulkSetProductSections,
  createOrderSection,
  deleteOrderSection,
  getOrderSections,
  updateOrderSection,
} from '../../services/api';
import { orderKeys } from '../../services/queryKeys';
import type { OrderSection, OrderSectionPayload } from '../../types/api';
import { useApiMutation } from '../useApiMutation';
import { useApiListQuery } from '../useApiQuery';

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

export function useUpdateOrderSectionMutation(companyId: string) {
  return useApiMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<OrderSectionPayload> }) =>
      updateOrderSection(id, body, companyId),
    invalidateQueries: [['orderSections', companyId], orderKeys.products(companyId)],
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

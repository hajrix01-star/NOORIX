import type { CreateOrderLinePayload, OrderProduct, OrderRecord } from '../../../types/api';

export type OrderDraftLine = CreateOrderLinePayload;
export type OrderAddModalState = {
  product: OrderProduct;
  variantKey: string;
  size: string;
  packaging: string;
  unit: string;
  quantity: string;
  unitPrice: string;
};

export type OrderMutation<TBody, TResult> = {
  isPending?: boolean;
  mutate: (
    body: TBody,
    options?: {
      onSuccess?: (result: { data?: TResult } | TResult) => void;
      onError?: (error: Error) => void;
    },
  ) => void;
};

function hasMutationEnvelope<TResult>(result: { data?: TResult } | TResult): result is { data?: TResult } {
  return Boolean(result && typeof result === 'object' && 'data' in result);
}

export function orderMutationData<TResult>(result: { data?: TResult } | TResult): TResult | undefined {
  if (hasMutationEnvelope(result)) return result.data;
  return result;
}

export function buildOrderDraftLines(initialOrder: OrderRecord | null | undefined): OrderDraftLine[] {
  if (!initialOrder?.items?.length) return [];
  return initialOrder.items.map((item) => ({
    productId: item.productId,
    size: item.size || '',
    packaging: item.packaging || '',
    unit: item.unit || '',
    quantity: String(item.quantity ?? ''),
    unitPrice: String(item.unitPrice ?? ''),
  }));
}

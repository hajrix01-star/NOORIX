import type { ApiParsedResult } from '../../../types/api';
import { apiGet, apiPatch, apiPost } from '../../core/apiHttp';

export type PurchaseDebtStatus = 'pending' | 'promoted' | 'cancelled';

export type PurchaseDebtRecord = {
  id: string;
  supplierId: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  totalAmount: string | number;
  isTaxable: boolean;
  notes: string | null;
  status: PurchaseDebtStatus;
  createdAt: string;
  promotedAt: string | null;
  promotionBatchId: string | null;
  supplier: { id: string; nameAr: string; nameEn?: string | null; isTaxRegistered?: boolean };
  promotedInvoice?: { id: string; invoiceNumber: string; status: string } | null;
  createdByUser?: { id: string; nameAr?: string | null; nameEn?: string | null; email: string } | null;
  promotedByUser?: { id: string; nameAr?: string | null; nameEn?: string | null; email: string } | null;
};

export type PurchaseDebtSummary = {
  totalCount: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  promotedCount: number;
  promotedAmount: number;
  cancelledCount: number;
  promotionRate: number;
};

export type PurchaseDebtListResponse = {
  items: PurchaseDebtRecord[];
  total: number;
  page: number;
  pageSize: number;
  summary: PurchaseDebtSummary;
};

export type PurchaseDebtCreateInput = {
  supplierId: string;
  supplierInvoiceNumber: string;
  invoiceDate: string;
  totalAmount: number;
  isTaxable?: boolean;
  notes?: string;
};

export type PurchaseDebtBatchCreateResponse = {
  count: number;
  items: PurchaseDebtRecord[];
};

export type PurchaseDebtQuery = {
  status?: PurchaseDebtStatus | '';
  supplierId?: string;
  q?: string;
  invoiceFrom?: string;
  invoiceTo?: string;
  promotedFrom?: string;
  promotedTo?: string;
  createdFrom?: string;
  createdTo?: string;
  amountMin?: string;
  amountMax?: string;
  page?: number;
  pageSize?: number;
};

function queryString(query: PurchaseDebtQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== '' && value != null) params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}

export function getPurchaseDebts(query: PurchaseDebtQuery): Promise<ApiParsedResult<PurchaseDebtListResponse>> {
  return apiGet(`/api/v1/purchase-debts${queryString(query)}`);
}

export function createPurchaseDebt(body: unknown): Promise<ApiParsedResult<PurchaseDebtRecord>> {
  return apiPost('/api/v1/purchase-debts', body);
}

export function createPurchaseDebtsBatch(
  items: PurchaseDebtCreateInput[],
): Promise<ApiParsedResult<PurchaseDebtBatchCreateResponse>> {
  return apiPost('/api/v1/purchase-debts/batch', { items });
}

export function updatePurchaseDebt(id: string, body: unknown): Promise<ApiParsedResult<PurchaseDebtRecord>> {
  return apiPatch(`/api/v1/purchase-debts/${encodeURIComponent(id)}`, body);
}

export function cancelPurchaseDebt(id: string): Promise<ApiParsedResult<PurchaseDebtRecord>> {
  return apiPost(`/api/v1/purchase-debts/${encodeURIComponent(id)}/cancel`, {});
}

export function restorePurchaseDebt(id: string): Promise<ApiParsedResult<PurchaseDebtRecord>> {
  return apiPost(`/api/v1/purchase-debts/${encodeURIComponent(id)}/restore`, {});
}

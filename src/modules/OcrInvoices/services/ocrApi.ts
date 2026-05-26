/** OCR invoices — extraction and review API helpers */
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '../../../services/api';
import type {
  OcrInvoiceSaveBody,
  OcrItemMutationBody,
  OcrMutationResult,
  OcrSupplierMutationBody,
} from '../../../types/api';

// --- OCR extraction ---

export async function extractInvoice(imageBase64: any, mimeType: any = 'image/jpeg') {
  // Vision calls can be slow — allow up to 90s
  return apiPost('/api/v1/ocr/extract', { imageBase64, mimeType }, { timeout: 90000 });
}

/** Submit image for async OCR pipeline (does not wait for extraction) */
export async function submitOcrSubmission(imageBase64: any, mimeType: any = 'image/jpeg') {
  return apiPost('/api/v1/ocr/submissions', { imageBase64, mimeType }, { timeout: 120000 });
}

// --- OCR invoices ---

export async function getOcrReviewQueue() {
  return apiGet('/api/v1/ocr/invoices/review-queue');
}

export async function getOcrInvoices() {
  return apiGet('/api/v1/ocr/invoices');
}

export async function getOcrInvoice(id: any) {
  return apiGet(`/api/v1/ocr/invoices/${encodeURIComponent(id)}`);
}

/** Purchases-by-month report for OCR supplier matching */
export async function getOcrPurchasesByMonth(month: any) {
  const params = new URLSearchParams();
  if (month) params.set('month', month);
  const q = params.toString();
  return apiGet(`/api/v1/ocr/reports/purchases-by-month${q ? `?${q}` : ''}`);
}

export async function getOcrAccountingSupplierSuggestions(filters: Record<string, any> = {}) {
  const { ocrSupplierId, q, invoiceVat, limit } = filters;
  const params = new URLSearchParams();
  if (ocrSupplierId) params.set('ocrSupplierId', ocrSupplierId);
  if (q) params.set('q', q);
  if (invoiceVat) params.set('invoiceVat', invoiceVat);
  if (limit != null) params.set('limit', String(limit));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return apiGet(`/api/v1/ocr/accounting-supplier-suggestions${suffix}`);
}

export async function saveOcrInvoice(data: OcrInvoiceSaveBody) {
  return apiPost<OcrMutationResult>('/api/v1/ocr/invoices', data);
}

export async function confirmOcrInvoice(id: any, status: any) {
  return apiPatch(`/api/v1/ocr/invoices/${id}/confirm`, { status });
}

// --- OCR suppliers ---

export async function getOcrSuppliers() {
  return apiGet('/api/v1/ocr/suppliers');
}

export async function createOcrSupplier(data: OcrSupplierMutationBody) {
  return apiPost<OcrMutationResult>('/api/v1/ocr/suppliers', data);
}

export async function updateOcrSupplier(id: string, data: OcrSupplierMutationBody) {
  return apiPut<OcrMutationResult>(`/api/v1/ocr/suppliers/${id}`, data);
}

export async function deleteOcrSupplier(id: any) {
  return apiDelete(`/api/v1/ocr/suppliers/${id}`);
}

export async function addSupplierAlias(id: any, alias: any, language: any = 'ar') {
  return apiPost(`/api/v1/ocr/suppliers/${id}/aliases`, { alias, language });
}

// --- OCR catalog items ---

export async function getOcrItems() {
  return apiGet('/api/v1/ocr/items');
}

export async function createOcrItem(data: OcrItemMutationBody) {
  return apiPost<OcrMutationResult>('/api/v1/ocr/items', data);
}

export async function updateOcrItem(id: string, data: OcrItemMutationBody) {
  return apiPut<OcrMutationResult>(`/api/v1/ocr/items/${id}`, data);
}

export async function deleteOcrItem(id: any) {
  return apiDelete(`/api/v1/ocr/items/${id}`);
}

export async function getItemPriceHistory(id: any) {
  return apiGet(`/api/v1/ocr/items/${id}/price-history`);
}

export async function addItemAlias(id: any, alias: any, language: any = 'ar') {
  return apiPost(`/api/v1/ocr/items/${id}/aliases`, { alias, language });
}

export async function findDuplicateItems() {
  return apiGet('/api/v1/ocr/items/duplicates');
}

export async function mergeOcrItems(keepId: any, mergeId: any) {
  return apiPost(`/api/v1/ocr/items/${keepId}/merge/${mergeId}`, {});
}

export async function bulkDeleteOcrInvoices(ids: any) {
  return apiPost('/api/v1/ocr/invoices/bulk-delete', { ids });
}

export async function bulkDeleteOcrSuppliers(ids: any) {
  return apiPost('/api/v1/ocr/suppliers/bulk-delete', { ids });
}

export async function bulkDeleteOcrItems(ids: any) {
  return apiPost('/api/v1/ocr/items/bulk-delete', { ids });
}

export async function bulkDeletePriceHistory(itemIds: any) {
  return apiPost('/api/v1/ocr/price-history/bulk-delete', { itemIds });
}

// --- OCR price alerts ---

export async function getPriceAlerts() {
  return apiGet('/api/v1/ocr/price-alerts');
}

// --- OCR correction rules ---

export async function getCorrectionRules() {
  return apiGet('/api/v1/ocr/correction-rules');
}

export async function updateCorrectionRule(id: any, status: any) {
  return apiPatch(`/api/v1/ocr/correction-rules/${id}`, { status });
}

/**
 * OCR Invoices API ظ¤ ╪«╪»┘à╪د╪ز ╪د╪│╪ز╪«╪▒╪د╪ش ╪د┘┘┘ê╪د╪ز┘è╪▒
 */
import { apiGet, apiPost, apiPut, apiDelete, apiPatch } from '../../../services/api';

// ظ¤ظ¤ظ¤ OCR Extraction ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤

export async function extractInvoice(imageBase64, mimeType = 'image/jpeg') {
  // Gemini Vision ┘é╪» ┘è╪ث╪«╪░ ┘ê┘é╪ز╪د┘ï ظ¤ timeout 90 ╪س╪د┘┘è╪ر
  return apiPost('/api/v1/ocr/extract', { imageBase64, mimeType }, { timeout: 90000 });
}

/** ┘â╪د╪┤┘è╪▒: ╪ح╪▒╪│╪د┘ ╪╡┘ê╪▒╪ر ┘┘╪د╪│╪ز╪«╪▒╪د╪ش ┘┘è ╪د┘╪«┘┘┘è╪ر ظ¤ ┘╪د ┘è┘╪ز╪╕╪▒ ╪د┘╪د╪│╪ز╪«╪▒╪د╪ش */
export async function submitOcrSubmission(imageBase64, mimeType = 'image/jpeg') {
  return apiPost('/api/v1/ocr/submissions', { imageBase64, mimeType }, { timeout: 120000 });
}

// ظ¤ظ¤ظ¤ Invoices ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤

export async function getOcrReviewQueue() {
  return apiGet('/api/v1/ocr/invoices/review-queue');
}

export async function getOcrInvoices() {
  return apiGet('/api/v1/ocr/invoices');
}

export async function getOcrInvoice(id) {
  return apiGet(`/api/v1/ocr/invoices/${encodeURIComponent(id)}`);
}

/** ╪د┘é╪ز╪▒╪د╪ص ┘à┘ê╪▒╪»┘è ╪د┘┘à╪ص╪د╪│╪ذ╪ر ┘┘à╪╖╪د╪ذ┘é╪ر ┘à┘ê╪▒╪» OCR */
export async function getOcrPurchasesByMonth(month) {
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

export async function saveOcrInvoice(data) {
  return apiPost('/api/v1/ocr/invoices', data);
}

export async function confirmOcrInvoice(id, status) {
  return apiPatch(`/api/v1/ocr/invoices/${id}/confirm`, { status });
}

// ظ¤ظ¤ظ¤ Suppliers ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤

export async function getOcrSuppliers() {
  return apiGet('/api/v1/ocr/suppliers');
}

export async function createOcrSupplier(data) {
  return apiPost('/api/v1/ocr/suppliers', data);
}

export async function updateOcrSupplier(id, data) {
  return apiPut(`/api/v1/ocr/suppliers/${id}`, data);
}

export async function deleteOcrSupplier(id) {
  return apiDelete(`/api/v1/ocr/suppliers/${id}`);
}

export async function addSupplierAlias(id, alias, language = 'ar') {
  return apiPost(`/api/v1/ocr/suppliers/${id}/aliases`, { alias, language });
}

// ظ¤ظ¤ظ¤ Items ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤

export async function getOcrItems() {
  return apiGet('/api/v1/ocr/items');
}

export async function createOcrItem(data) {
  return apiPost('/api/v1/ocr/items', data);
}

export async function updateOcrItem(id, data) {
  return apiPut(`/api/v1/ocr/items/${id}`, data);
}

export async function deleteOcrItem(id) {
  return apiDelete(`/api/v1/ocr/items/${id}`);
}

export async function getItemPriceHistory(id) {
  return apiGet(`/api/v1/ocr/items/${id}/price-history`);
}

export async function addItemAlias(id, alias, language = 'ar') {
  return apiPost(`/api/v1/ocr/items/${id}/aliases`, { alias, language });
}

export async function findDuplicateItems() {
  return apiGet('/api/v1/ocr/items/duplicates');
}

export async function mergeOcrItems(keepId, mergeId) {
  return apiPost(`/api/v1/ocr/items/${keepId}/merge/${mergeId}`, {});
}

export async function bulkDeleteOcrInvoices(ids) {
  return apiPost('/api/v1/ocr/invoices/bulk-delete', { ids });
}

export async function bulkDeleteOcrSuppliers(ids) {
  return apiPost('/api/v1/ocr/suppliers/bulk-delete', { ids });
}

export async function bulkDeleteOcrItems(ids) {
  return apiPost('/api/v1/ocr/items/bulk-delete', { ids });
}

export async function bulkDeletePriceHistory(itemIds) {
  return apiPost('/api/v1/ocr/price-history/bulk-delete', { itemIds });
}

// ظ¤ظ¤ظ¤ Price Alerts ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤

export async function getPriceAlerts() {
  return apiGet('/api/v1/ocr/price-alerts');
}

// ظ¤ظ¤ظ¤ Correction Rules ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤ظ¤

export async function getCorrectionRules() {
  return apiGet('/api/v1/ocr/correction-rules');
}

export async function updateCorrectionRule(id, status) {
  return apiPatch(`/api/v1/ocr/correction-rules/${id}`, { status });
}

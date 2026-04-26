import { getAuthToken, getActiveCompanyId } from '../../services/authStore';
import { getApiBaseUrl } from '../../services/api';

/** مفتاح موحّد لصورة فاتورة OCR — يُشارك بين المصغّر وprefill الرفع لتفادي طلبات /image مكررة */
export function ocrInvoiceImageQueryKey(companyId: any, invoiceId: any) {
  return ['ocr-invoice-image', String(companyId ?? ''), String(invoiceId ?? '')];
}

export async function fetchOcrInvoiceImageBlob(invoiceId: any, signal: any) {
  const url = new URL(`/api/v1/ocr/invoices/${encodeURIComponent(invoiceId)}/image`, getApiBaseUrl());
  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Authorization: `Bearer ${getAuthToken() || ''}`,
      'x-company-id': String(getActiveCompanyId() || ''),
    },
  });
  if (!res.ok) {
    const err = new Error(`ocr image ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return res.blob();
}

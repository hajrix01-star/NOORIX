import type {
  ApiParsedResult,
  AssetCompleteFromInvoicePayload,
  AssetCreatePayload,
  AssetRegisterItem,
  AssetRegisterPage,
  AssetUpdatePayload,
  AssetWarrantyFilter,
  PendingWarrantyInvoiceRow,
} from '../../../types/api';
import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  getApiBaseUrl,
  getAuthHeaders,
  parseResponse,
  safeFetch,
} from '../../core/apiHttp';

export type GetCompanyAssetsParams = {
  warrantyFilter?: AssetWarrantyFilter;
  q?: string;
  page?: number;
  pageSize?: number;
};

export async function getCompanyAssets(
  companyId: string,
  {
    warrantyFilter,
    q,
    page = 1,
    pageSize = 50,
  }: GetCompanyAssetsParams = {},
): Promise<ApiParsedResult<AssetRegisterPage>> {
  const params: Record<string, string> = {
    companyId: String(companyId),
    page: String(page),
    pageSize: String(pageSize),
  };
  if (warrantyFilter && warrantyFilter !== 'all') params.warrantyFilter = warrantyFilter;
  if (q?.trim()) params.q = q.trim();
  return apiGet('/api/v1/company-assets', params);
}

export async function getCompanyAsset(id: string, companyId: string): Promise<ApiParsedResult<AssetRegisterItem>> {
  return apiGet(`/api/v1/company-assets/${id}`, { companyId });
}

export async function createCompanyAsset(body: AssetCreatePayload): Promise<ApiParsedResult<AssetRegisterItem>> {
  return apiPost('/api/v1/company-assets', body);
}

export async function updateCompanyAsset(
  id: string,
  companyId: string,
  body: AssetUpdatePayload,
): Promise<ApiParsedResult<AssetRegisterItem>> {
  return apiPatch(`/api/v1/company-assets/${id}?companyId=${companyId}`, body);
}

export async function deleteCompanyAsset(id: string, companyId: string): Promise<ApiParsedResult<{ ok: true }>> {
  return apiDelete(`/api/v1/company-assets/${id}?companyId=${companyId}`);
}

export async function getPendingWarrantyInvoices(companyId: string): Promise<ApiParsedResult<PendingWarrantyInvoiceRow[]>> {
  return apiGet('/api/v1/company-assets/pending-invoices', { companyId });
}

export async function completeCompanyAssetFromInvoice(
  body: AssetCompleteFromInvoicePayload,
): Promise<ApiParsedResult<AssetRegisterItem>> {
  return apiPost('/api/v1/company-assets/complete-from-invoice', body);
}

export async function completeCompanyAssetFromInvoiceWithAttachment(
  body: AssetCompleteFromInvoicePayload,
  file: File,
): Promise<ApiParsedResult<AssetRegisterItem>> {
  const url = new URL('/api/v1/company-assets/complete-from-invoice-with-attachment', getApiBaseUrl());
  const headers = getAuthHeaders();
  delete headers['Content-Type'];
  const buildBody = () => {
    const formData = new FormData();
    formData.append('payload', JSON.stringify(body));
    formData.append('file', file);
    return formData;
  };
  const doFetch = async () => {
    const retryHeaders = getAuthHeaders();
    delete retryHeaders['Content-Type'];
    const retryRes = await safeFetch(url.toString(), {
      method: 'POST',
      headers: retryHeaders,
      body: buildBody(),
    }, 30000);
    return parseResponse<AssetRegisterItem>(retryRes);
  };
  try {
    const res = await safeFetch(url.toString(), {
      method: 'POST',
      headers,
      body: buildBody(),
    }, 30000);
    return parseResponse<AssetRegisterItem>(res, doFetch);
  } catch (error: unknown) {
    return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
  }
}

export async function getCompanyAssetWarrantyAttachmentObjectUrl(
  id: string,
  companyId: string,
): Promise<string> {
  const url = new URL(`/api/v1/company-assets/${encodeURIComponent(id)}/warranty-attachment`, getApiBaseUrl());
  url.searchParams.set('companyId', companyId);
  const res = await safeFetch(url.toString(), {
    method: 'GET',
    headers: getAuthHeaders(),
  }, 30000);
  if (!res.ok) {
    const raw = await res.json().catch(() => ({}));
    const message = Array.isArray(raw?.message)
      ? raw.message.join(', ')
      : raw?.message || raw?.error || 'Attachment unavailable';
    throw new Error(String(message));
  }
  return URL.createObjectURL(await res.blob());
}

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
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

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

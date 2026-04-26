import type { ApiParsedResult } from '../../../types/api';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— سجل الأصول (ضمان، مدة) ———
export async function getCompanyAssets(
  companyId: string,
  {
    warrantyFilter,
    q,
    page = 1,
    pageSize = 50,
  }: {
    warrantyFilter?: string;
    q?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<ApiParsedResult> {
  const params: Record<string, string> = {
    companyId: String(companyId),
    page: String(page),
    pageSize: String(pageSize),
  };
  if (warrantyFilter) params.warrantyFilter = warrantyFilter;
  if (q && String(q).trim()) params.q = String(q).trim();
  return apiGet('/api/v1/company-assets', params);
}
export async function getCompanyAsset(id: string, companyId: string): Promise<ApiParsedResult> {
  return apiGet(`/api/v1/company-assets/${id}`, { companyId });
}
export async function createCompanyAsset(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/company-assets', body);
}
export async function updateCompanyAsset(
  id: string,
  companyId: string,
  body: unknown,
): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/company-assets/${id}?companyId=${companyId}`, body);
}
export async function deleteCompanyAsset(id: string, companyId: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/company-assets/${id}?companyId=${companyId}`);
}
export async function getPendingWarrantyInvoices(companyId: string): Promise<ApiParsedResult> {
  return apiGet('/api/v1/company-assets/pending-invoices', { companyId });
}
export async function completeCompanyAssetFromInvoice(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/company-assets/complete-from-invoice', body);
}

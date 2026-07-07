import type { ApiParsedResult } from '../../../types/api';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';
import { suppliersListQueryParams } from './suppliers-query';

export async function getSuppliers(
  companyId: string,
  page = 1,
  pageSize = 50,
  q?: string,
): Promise<ApiParsedResult> {
  return apiGet('/api/v1/suppliers', suppliersListQueryParams({ companyId, page, pageSize, q }));
}

export async function createSupplier(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/suppliers', body);
}

export async function updateSupplier(id: string, body: unknown): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/suppliers/${id}`, body);
}

export async function deleteSupplier(id: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/suppliers/${id}`);
}

export async function setSupplierBookmark(id: string, isBookmarked: boolean): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/suppliers/${id}/bookmark`, { isBookmarked });
}

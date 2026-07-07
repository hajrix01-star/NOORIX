import type { ApiParsedResult } from '../../../types/api';
import type {
  SupplierCreatePayload,
  SupplierRecord,
  SupplierUpdatePayload,
} from '../../../modules/Suppliers/supplierTypes';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';
import { suppliersListQueryParams } from './suppliers-query';

type SuppliersListResult = SupplierRecord[] | {
  items?: SupplierRecord[];
  total?: number;
  page?: number;
  pageSize?: number;
};

export async function getSuppliers(
  companyId: string,
  page = 1,
  pageSize = 50,
  q?: string,
): Promise<ApiParsedResult<SuppliersListResult>> {
  return apiGet('/api/v1/suppliers', suppliersListQueryParams({ companyId, page, pageSize, q }));
}

export async function createSupplier(body: SupplierCreatePayload): Promise<ApiParsedResult<SupplierRecord>> {
  return apiPost('/api/v1/suppliers', body);
}

export async function updateSupplier(id: string, body: SupplierUpdatePayload): Promise<ApiParsedResult<SupplierRecord>> {
  return apiPatch(`/api/v1/suppliers/${id}`, body);
}

export async function deleteSupplier(id: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete(`/api/v1/suppliers/${id}`);
}

export async function setSupplierBookmark(
  id: string,
  isBookmarked: boolean,
): Promise<ApiParsedResult<SupplierRecord>> {
  return apiPatch(`/api/v1/suppliers/${id}/bookmark`, { isBookmarked });
}

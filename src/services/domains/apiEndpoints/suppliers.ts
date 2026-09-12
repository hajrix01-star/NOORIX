import type { ApiParsedResult } from '../../../types/api';
import type {
  SupplierCreatePayload,
  SupplierDirectoryAddResult,
  SupplierDirectoryResult,
  SupplierRecord,
  SupplierUpdatePayload,
} from '../../../modules/Suppliers/supplierTypes';
import { apiGet, apiPost, apiPatch, apiDelete, throwIfApiFailed } from '../../core/apiHttp';
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

/** يجلب كل صفحات الموردين للتصدير فقط؛ لا يعيد ملفاً جزئياً إذا فشلت صفحة لاحقة. */
export async function fetchAllSuppliersForExport(companyId: string): Promise<SupplierRecord[]> {
  if (!companyId) return [];
  const pageSize = 200;
  const maximumPages = 500;
  const all: SupplierRecord[] = [];
  let expectedTotal: number | undefined;

  for (let page = 1; page <= maximumPages; page += 1) {
    const res = await getSuppliers(companyId, page, pageSize);
    throwIfApiFailed(res, 'فشل تحميل الموردين للتصدير');
    const pack = res.data;
    if (Array.isArray(pack) || !pack || !Array.isArray(pack.items) || typeof pack.total !== 'number' || !Number.isSafeInteger(pack.total) || pack.total < 0) {
      throw new Error('بيانات الموردين غير مكتملة؛ أعد المحاولة قبل التصدير');
    }
    const reportedTotal = pack.total;

    if (expectedTotal === undefined) {
      expectedTotal = reportedTotal;
      if (expectedTotal > maximumPages * pageSize) {
        throw new Error('عدد الموردين يتجاوز الحد الآمن للتصدير');
      }
    } else if (reportedTotal !== expectedTotal) {
      throw new Error('تغيرت بيانات الموردين أثناء التصدير؛ أعد المحاولة');
    }
    const targetTotal = expectedTotal;
    if (targetTotal === undefined) {
      throw new Error('بيانات الموردين غير مكتملة؛ أعد المحاولة قبل التصدير');
    }

    const items = pack.items;
    all.push(...items);
    if (all.length === targetTotal) return all;
    if (all.length > targetTotal || items.length < pageSize) {
      throw new Error('بيانات الموردين غير مكتملة؛ أعد المحاولة قبل التصدير');
    }
  }

  throw new Error('تجاوز تصدير الموردين الحد الآمن للصفحات');
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

export async function getSupplierDirectory(
  companyId: string,
  q?: string,
): Promise<ApiParsedResult<SupplierDirectoryResult>> {
  return apiGet('/api/v1/supplier-directory', { companyId, q });
}

export async function addSupplierDirectoryEntry(
  companyId: string,
  code: string,
): Promise<ApiParsedResult<SupplierDirectoryAddResult>> {
  return apiPost(`/api/v1/supplier-directory/${code}/add`, { companyId });
}

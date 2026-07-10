import type { ApiParsedResult } from '../../../types/api';
import type {
  ExpenseCategoryRef,
  ExpenseLineCreatePayload,
  ExpenseLinePaymentsPage,
  ExpenseLineRecord,
  ExpenseLineUpdatePayload,
} from '../../../types/api';
import { toYmd } from '../../../utils/saudiDate';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— الحسابات والفئات ———
type AccountRef = {
  id: string;
  code?: string | null;
  nameAr?: string | null;
  nameEn?: string | null;
  [key: string]: unknown;
};

export async function getAccounts(companyId: string): Promise<ApiParsedResult<AccountRef[]>> {
  const res = await apiGet<AccountRef[]>('/api/v1/accounts', { companyId });
  if (!res.success) return res;
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}
export async function getCategories(companyId: string): Promise<ApiParsedResult<ExpenseCategoryRef[]>> {
  return apiGet('/api/v1/categories', { companyId });
}
export async function createCategory(body: unknown): Promise<ApiParsedResult<ExpenseCategoryRef>> {
  return apiPost('/api/v1/categories', body);
}
export async function updateCategory(id: string, body: unknown): Promise<ApiParsedResult<ExpenseCategoryRef>> {
  return apiPatch(`/api/v1/categories/${id}`, body);
}
export async function deleteCategory(id: string, companyId: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete(`/api/v1/categories/${id}?companyId=${companyId}`);
}

// ——— بنود المصاريف (ثابت/متغير) ———
export async function getExpenseLines(
  companyId: string,
  kind?: string | null,
  includeInactive = false,
): Promise<ApiParsedResult<ExpenseLineRecord[]>> {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (kind) params.kind = String(kind);
  if (includeInactive) params.includeInactive = 'true';
  const res = await apiGet<ExpenseLineRecord[]>('/api/v1/expense-lines', params);
  if (!res.success) return res;
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}
export async function getExpenseLine(id: string, companyId: string): Promise<ApiParsedResult<ExpenseLineRecord>> {
  return apiGet(`/api/v1/expense-lines/${id}`, { companyId });
}
export async function getExpenseLinePayments(
  id: string,
  companyId: string,
  startDate: string | undefined,
  endDate: string | undefined,
  page = 1,
  pageSize = 50,
): Promise<ApiParsedResult<ExpenseLinePaymentsPage>> {
  const params: Record<string, string> = {
    companyId: String(companyId),
    page: String(page),
    pageSize: String(pageSize),
  };
  if (startDate) params.startDate = toYmd(startDate);
  if (endDate) params.endDate = toYmd(endDate);
  return apiGet(`/api/v1/expense-lines/${id}/payments`, params);
}
export async function createExpenseLine(body: ExpenseLineCreatePayload): Promise<ApiParsedResult<ExpenseLineRecord>> {
  return apiPost('/api/v1/expense-lines', body);
}
export async function updateExpenseLine(
  id: string,
  body: ExpenseLineUpdatePayload,
  companyId: string,
): Promise<ApiParsedResult<ExpenseLineRecord>> {
  return apiPatch(`/api/v1/expense-lines/${id}?companyId=${companyId}`, body);
}
export async function deactivateExpenseLine(id: string, companyId: string): Promise<ApiParsedResult<ExpenseLineRecord>> {
  return apiPatch(`/api/v1/expense-lines/${id}/deactivate?companyId=${companyId}`, {});
}

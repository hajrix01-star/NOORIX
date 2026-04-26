import type { ApiParsedResult } from '../../../types/api';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— الخزائن ———
export async function getVaults(
  companyId: string,
  includeArchived: any = false,
  startDate?: string,
  endDate?: string,
): Promise<ApiParsedResult> {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (includeArchived) params.includeArchived = 'true';
  if (startDate) params.startDate = String(startDate).slice(0, 25);
  if (endDate) params.endDate = String(endDate).slice(0, 25);
  return apiGet('/api/v1/vaults', params);
}
export async function getPaymentVaults(companyId: string): Promise<ApiParsedResult> {
  return apiGet('/api/v1/vaults/payment-options', { companyId });
}
export async function getSalesChannels(companyId: string): Promise<ApiParsedResult> {
  return apiGet('/api/v1/vaults/sales-channels', { companyId });
}
export async function getVaultTransactions(
  vaultId: string,
  companyId: string,
  startDate: string | undefined,
  endDate: string | undefined,
  page: any = 1,
  pageSize: any = 50,
): Promise<ApiParsedResult> {
  const params: Record<string, string> = {
    companyId: String(companyId),
    page: String(page),
    pageSize: String(pageSize),
  };
  if (startDate) params.startDate = String(startDate);
  if (endDate) params.endDate = String(endDate);
  return apiGet(`/api/v1/vaults/${vaultId}/transactions`, params);
}
export async function updateVault(id: string, body: unknown): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/vaults/${id}`, body);
}
/** ترتيب الخزائن النشطة — الجسم: { vaultIds: string[] } */
export async function reorderVaults(vaultIds: string[]): Promise<ApiParsedResult> {
  return apiPatch('/api/v1/vaults/reorder', { vaultIds });
}
export async function archiveVault(id: string): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/vaults/${id}/archive`, {});
}
export async function deleteVault(id: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/vaults/${id}`);
}
export async function createVault(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/vaults', body);
}

/** تحويل نقد بين خزينتين — قيد transfer (بدون فاتورة) */
export async function createVaultTransfer(body: unknown): Promise<ApiParsedResult> {
  return apiPost('/api/v1/vaults/transfer', body);
}

import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

// ——— الخزائن ———
export async function getVaults(companyId, includeArchived = false, startDate, endDate) {
  const params = { companyId, ...(includeArchived ? { includeArchived: 'true' } : {}) };
  if (startDate) params.startDate = String(startDate).slice(0, 25);
  if (endDate) params.endDate = String(endDate).slice(0, 25);
  return apiGet('/api/v1/vaults', params);
}
export async function getPaymentVaults(companyId) {
  return apiGet('/api/v1/vaults/payment-options', { companyId });
}
export async function getSalesChannels(companyId) {
  return apiGet('/api/v1/vaults/sales-channels', { companyId });
}
export async function getVaultTransactions(vaultId, companyId, startDate, endDate, page = 1, pageSize = 50) {
  const params = { companyId, page: String(page), pageSize: String(pageSize) };
  if (startDate) params.startDate = startDate;
  if (endDate)   params.endDate   = endDate;
  return apiGet(`/api/v1/vaults/${vaultId}/transactions`, params);
}
export async function updateVault(id, body) { return apiPatch(`/api/v1/vaults/${id}`, body); }
/** ترتيب الخزائن النشطة — الجسم: { vaultIds: string[] } */
export async function reorderVaults(vaultIds) {
  return apiPatch('/api/v1/vaults/reorder', { vaultIds });
}
export async function archiveVault(id) { return apiPatch(`/api/v1/vaults/${id}/archive`, {}); }
export async function deleteVault(id) { return apiDelete(`/api/v1/vaults/${id}`); }
export async function createVault(body) { return apiPost('/api/v1/vaults', body); }

/** تحويل نقد بين خزينتين — قيد transfer (بدون فاتورة) */
export async function createVaultTransfer(body) {
  return apiPost('/api/v1/vaults/transfer', body);
}

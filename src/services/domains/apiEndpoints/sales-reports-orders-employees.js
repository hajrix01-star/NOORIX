import { getAuthToken, getActiveCompanyId, setRefreshToken } from '../../authStore';
import {
  apiGet,
  apiPost,
  apiPatch,
  apiPut,
  apiDelete,
  safeFetch,
  parseResponse,
  getApiBaseUrl,
  throwIfApiFailed,
  getAuthHeaders,
  handleUnauthorized,
} from '../../core/apiHttp';

// ——— ملخصات المبيعات اليومية ———
export async function createDailySalesSummary(body) { return apiPost('/api/v1/sales/summary', body); }
export async function updateDailySalesSummary(id, body, companyId) {
  return apiPatch(`/api/v1/sales/summaries/${id}?companyId=${companyId}`, body);
}
export async function cancelDailySalesSummary(id, companyId) {
  return apiDelete(`/api/v1/sales/summaries/${id}?companyId=${companyId}`);
}
export async function deleteDailySalesSummary(id, companyId) {
  return apiDelete(`/api/v1/sales/summaries/${id}?companyId=${companyId}`);
}
/** حزمة ملخصات مبيعات للوحة التحكم — سنة + نطاق يومي + نطاق شهري في استجابة واحدة */
export async function getDashboardSalesPack({
  companyId,
  yearStart,
  yearEnd,
  dailyStart,
  dailyEnd,
  monthStart,
  monthEnd,
}) {
  const params = {
    companyId,
    yearStart: String(yearStart).slice(0, 10),
    yearEnd: String(yearEnd).slice(0, 10),
  };
  if (dailyStart) params.dailyStart = String(dailyStart).slice(0, 10);
  if (dailyEnd) params.dailyEnd = String(dailyEnd).slice(0, 10);
  if (monthStart) params.monthStart = String(monthStart).slice(0, 10);
  if (monthEnd) params.monthEnd = String(monthEnd).slice(0, 10);
  return apiGet('/api/v1/sales/summaries/dashboard-pack', params);
}

export async function getDailySalesSummaries(
  companyId,
  startDate,
  endDate,
  page = 1,
  pageSize = 50,
  q,
  sortBy,
  sortDir,
  includeCancelled,
) {
  const size = Math.min(200, Math.max(1, Number(pageSize) || 50));
  const params = { companyId, page: String(page), pageSize: String(size) };
  if (startDate) params.startDate = String(startDate).slice(0, 10);
  if (endDate) params.endDate = String(endDate).slice(0, 10);
  if (q && String(q).trim()) params.q = String(q).trim();
  if (sortBy) params.sortBy = sortBy;
  if (sortDir) params.sortDir = sortDir;
  if (includeCancelled) params.includeCancelled = '1';
  const res = await apiGet('/api/v1/sales/summaries', params);
  if (!res.success) return res;
  const raw = res.data?.data ?? res.data;
  const items = raw?.items ?? (Array.isArray(raw) ? raw : []);
  const total = Number(raw?.total ?? items.length) || 0;
  return {
    success: true,
    data: {
      items,
      total,
      page: Number(raw?.page) || page,
      pageSize: Number(raw?.pageSize) || size,
    },
  };
}

/** جلب كل ملخصات المبيعات في الفترة — للتصدير والطباعة */
export async function fetchAllSalesSummariesForExport(
  companyId,
  startDate,
  endDate,
  q,
  sortBy = 'transactionDate',
  sortDir = 'desc',
  includeCancelled = true,
) {
  const pageSize = 150;
  let page = 1;
  const acc = [];
  for (let guard = 0; guard < 80; guard++) {
    const res = await getDailySalesSummaries(
      companyId,
      startDate,
      endDate,
      page,
      pageSize,
      q,
      sortBy,
      sortDir,
      includeCancelled,
    );
    if (!res?.success) break;
    const { items = [], total = 0 } = res.data || {};
    acc.push(...items);
    const t = Number(total) || 0;
    if (acc.length >= t || items.length < pageSize) break;
    page += 1;
  }
  return acc;
}

/** ملخص دفعات المشتريات في الفترة — من السيرفر (بدل صفحة فواتير واحدة) */
export async function getPurchaseBatchSummaries(companyId, startDate, endDate, q, lang) {
  const params = { companyId };
  if (startDate) params.startDate = String(startDate).slice(0, 10);
  if (endDate) params.endDate = String(endDate).slice(0, 10);
  if (q && String(q).trim()) params.q = String(q).trim();
  if (lang) params.lang = lang;
  const res = await apiGet('/api/v1/invoices/purchase-batch-summaries', params);
  if (!res.success) return { success: false, error: res.error, data: { batches: [], rowCount: 0 } };
  const raw = res.data?.data ?? res.data;
  return {
    success: true,
    data: {
      batches: Array.isArray(raw?.batches) ? raw.batches : [],
      rowCount: Number(raw?.rowCount) || 0,
    },
  };
}

// ——— التقارير ———
export async function getGeneralProfitLossReport(companyId, year) {
  return apiGet('/api/v1/reports/general-profit-loss', { companyId, year: String(year) });
}
export async function getGeneralProfitLossDetails(companyId, year, month, groupKey, itemKey) {
  const params = { companyId, year: String(year), groupKey };
  if (month != null && month !== '') params.month = String(month);
  if (itemKey) params.itemKey = itemKey;
  return apiGet('/api/v1/reports/general-profit-loss/details', params);
}
export async function getGeneralProfitLossTrend(companyId, year, groupKey, itemKey) {
  const params = { companyId, year: String(year), groupKey };
  if (itemKey) params.itemKey = itemKey;
  return apiGet('/api/v1/reports/general-profit-loss/trend', params);
}

/** @param {{ salesAmountIncludesVat?: boolean }} [opts] — عند true: المبيعات بدون ضريبة مسجّلة تُفسَّر كإجمالٍ شامل 15% */
export async function getTaxVatReport(companyId, year, period, opts = {}) {
  const params = { companyId, year: String(year), period };
  if (opts.salesAmountIncludesVat === true) params.salesAmountIncludesVat = 'true';
  return apiGet('/api/v1/reports/tax-vat', params);
}

/** سجل الضريبة التخطيطي (معزول عن المحاسبة) — REPORTS_READ */
export async function getVatPlanningList(year, quarter, companyId) {
  const params = { year: String(year), quarter: String(quarter) };
  if (companyId) params.companyId = companyId;
  return apiGet('/api/v1/vat-planning', params);
}

/** جميع الإقرارات المحفوظة مع فلاتر اختيارية — REPORTS_READ */
export async function getVatPlanningRegistry(filters = {}) {
  const params = {};
  if (filters.year != null && filters.year !== '') params.year = String(filters.year);
  if (filters.quarter != null && filters.quarter !== '') params.quarter = String(filters.quarter);
  if (filters.companyId) params.companyId = filters.companyId;
  return apiGet('/api/v1/vat-planning/registry', params);
}

export async function upsertVatPlanning(body) {
  return apiPut('/api/v1/vat-planning', body);
}

export async function deleteVatPlanning(companyId, year, quarter) {
  const qs = `companyId=${encodeURIComponent(companyId)}&year=${encodeURIComponent(String(year))}&quarter=${encodeURIComponent(String(quarter))}`;
  return apiDelete(`/api/v1/vat-planning?${qs}`);
}

/** تحليل فترة: إجماليات حسب نوع الفاتورة + أعلى موردين — يتطلب REPORTS_READ */
export async function getPeriodAnalytics(companyId, startDate, endDate) {
  const params = {
    companyId,
    startDate: String(startDate || '').slice(0, 10),
    endDate: String(endDate || '').slice(0, 10),
  };
  const res = await apiGet('/api/v1/reports/period-analytics', params);
  if (!res.success) return res;
  const raw = res.data?.data ?? res.data;
  return { success: true, data: raw };
}

// ——— الطلبات ———
export async function getOrders(companyId, year, month) {
  const res = await apiGet('/api/v1/orders', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function createOrder(body) {
  return apiPost('/api/v1/orders', body);
}
export async function updateOrder(id, body, companyId) {
  return apiPatch(`/api/v1/orders/${id}?companyId=${companyId}`, body);
}
export async function cancelOrder(id, companyId) {
  return apiDelete(`/api/v1/orders/${id}?companyId=${companyId}`);
}
export async function getOrdersSummary(companyId, year, month) {
  const res = await apiGet('/api/v1/orders/summary', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? {} } : { success: false, data: {} };
}
export async function getProductPurchaseHistory(companyId, productId, year, month) {
  const params = { companyId };
  if (year) params.year = String(year);
  if (month) params.month = String(month);
  const res = await apiGet(`/api/v1/orders/product-history/${productId}`, params);
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function getCategoryPurchaseHistory(companyId, categoryId, year, month) {
  const params = { companyId };
  if (year) params.year = String(year);
  if (month) params.month = String(month);
  const res = await apiGet(`/api/v1/orders/category-history/${categoryId}`, params);
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function getOrdersItemsReport(companyId, year, month) {
  const res = await apiGet('/api/v1/orders/items-report', { companyId, year: String(year), month: String(month) });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function getOrderProducts(companyId) {
  const res = await apiGet('/api/v1/orders/products', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function createOrderProduct(body) {
  return apiPost('/api/v1/orders/products', body);
}
export async function createOrderProductsBatch(companyId, products) {
  return apiPost('/api/v1/orders/products/batch', { companyId, products }, { timeout: 90000 });
}
export async function createOrderCategoriesBatch(companyId, categories) {
  return apiPost('/api/v1/orders/categories/batch', { companyId, categories }, { timeout: 60000 });
}
export async function updateOrderProduct(id, body, companyId) {
  return apiPatch(`/api/v1/orders/products/${id}?companyId=${companyId}`, body);
}
export async function getOrderCategories(companyId) {
  const res = await apiGet('/api/v1/orders/categories', { companyId });
  return res?.success ? { ...res, data: res.data ?? [] } : { success: false, data: [] };
}
export async function createOrderCategory(body) {
  return apiPost('/api/v1/orders/categories', body);
}
export async function updateOrderCategory(id, body, companyId) {
  return apiPatch(`/api/v1/orders/categories/${id}?companyId=${companyId}`, body);
}

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

// ——— الموظفون ———
/** قائمة كاملة (حدّ السيرفر) — للتوافق مع الشاشات التي لا ترسل page */
export async function getEmployees(companyId, includeTerminated = false) {
  const res = await apiGet('/api/v1/employees', {
    companyId: companyId || '',
    ...(includeTerminated ? { includeTerminated: 'true' } : {}),
  });
  if (!res.success) return { success: false, error: res.error, data: [] };
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}

/** ترقيم من السيرفر — tab: active | terminated | archived */
export async function getEmployeesPaged(companyId, { tab = 'active', page = 1, pageSize = 50, q = '', sortBy, sortDir } = {}) {
  const params = {
    companyId: companyId || '',
    page: String(page),
    pageSize: String(pageSize),
    tab,
  };
  if (q) params.q = q;
  if (sortBy) params.sortBy = sortBy;
  if (sortDir) params.sortDir = sortDir;
  const res = await apiGet('/api/v1/employees', params);
  if (!res.success) {
    return { success: false, error: res.error, items: [], total: 0, page: 1, pageSize };
  }
  const d = res.data;
  if (d && typeof d === 'object' && Array.isArray(d.items)) {
    return {
      success: true,
      items: d.items,
      total: Number(d.total) || 0,
      page: Number(d.page) || page,
      pageSize: Number(d.pageSize) || pageSize,
    };
  }
  return { success: true, items: [], total: 0, page: 1, pageSize };
}

/** تحميل مجمّع للتصدير (حد أقصى من السيرفر) */
export async function getEmployeesBulk(companyId, tab = 'active') {
  const res = await apiGet('/api/v1/employees', {
    companyId: companyId || '',
    bulk: '1',
    tab,
  });
  if (!res.success) return { success: false, error: res.error, data: [] };
  return { success: true, data: Array.isArray(res.data) ? res.data : [] };
}
export async function getEmployee(id, companyId) {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiGet(`/api/v1/employees/${id}`, { companyId });
}
export async function createEmployee(body) {
  return apiPost('/api/v1/employees', body);
}
export async function createEmployeesBatch(body) {
  return apiPost('/api/v1/employees/batch', body);
}
export async function updateEmployee(id, body, companyId) {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiPatch(`/api/v1/employees/${id}?companyId=${companyId}`, body);
}
export async function terminateEmployee(id, companyId) {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiPatch(`/api/v1/employees/${id}/terminate?companyId=${companyId}`, {});
}

/** حذف الموظف نهائياً من قاعدة البيانات — يتطلب صلاحية EMPLOYEES_DELETE */
export async function deleteEmployee(id, companyId) {
  if (!id || !companyId) return { success: false, error: 'معرف الموظف والشركة مطلوبان' };
  return apiDelete(`/api/v1/employees/${encodeURIComponent(id)}?companyId=${encodeURIComponent(companyId)}`);
}


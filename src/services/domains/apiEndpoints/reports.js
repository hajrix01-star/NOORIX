import { apiGet, apiPut, apiDelete } from '../../core/apiHttp';

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

import type { ApiParsedResult } from '../../../types/api';
import { apiGet, apiPut, apiDelete } from '../../core/apiHttp';

// ——— التقارير ———
export async function getGeneralProfitLossReport(
  companyId: string,
  year: string | number,
): Promise<ApiParsedResult> {
  return apiGet('/api/v1/reports/general-profit-loss', { companyId, year: String(year) });
}
export async function getGeneralProfitLossDetails(
  companyId: string,
  year: string | number,
  month: string | number | null | undefined,
  groupKey: string,
  itemKey?: string,
): Promise<ApiParsedResult> {
  const params: Record<string, string> = {
    companyId: String(companyId),
    year: String(year),
    groupKey: String(groupKey),
  };
  if (month != null && month !== '') params.month = String(month);
  if (itemKey) params.itemKey = itemKey;
  return apiGet('/api/v1/reports/general-profit-loss/details', params);
}
export async function getGeneralProfitLossTrend(
  companyId: string,
  year: string | number,
  groupKey: string,
  itemKey?: string,
): Promise<ApiParsedResult> {
  const params: Record<string, string> = {
    companyId: String(companyId),
    year: String(year),
    groupKey: String(groupKey),
  };
  if (itemKey) params.itemKey = itemKey;
  return apiGet('/api/v1/reports/general-profit-loss/trend', params);
}

/** @param opts — عند salesAmountIncludesVat: true تُفسَّر المبيعات كإجمالٍ شامل 15% */
export async function getTaxVatReport(
  companyId: string,
  year: string | number,
  period: string,
  opts: { salesAmountIncludesVat?: boolean } = {},
): Promise<ApiParsedResult> {
  const params: Record<string, string> = {
    companyId: String(companyId),
    year: String(year),
    period: String(period),
  };
  if (opts.salesAmountIncludesVat === true) params.salesAmountIncludesVat = 'true';
  return apiGet('/api/v1/reports/tax-vat', params);
}

/** سجل الضريبة التخطيطي (معزول عن المحاسبة) — REPORTS_READ */
export async function getVatPlanningList(
  year: string | number,
  quarter: string | number,
  companyId?: string,
): Promise<ApiParsedResult> {
  const params: Record<string, string> = { year: String(year), quarter: String(quarter) };
  if (companyId) params.companyId = companyId;
  return apiGet('/api/v1/vat-planning', params);
}

/** جميع الإقرارات المحفوظة مع فلاتر اختيارية — REPORTS_READ */
export async function getVatPlanningRegistry(filters: {
  year?: string | number;
  quarter?: string | number;
  companyId?: string;
} = {}): Promise<ApiParsedResult> {
  const params: Record<string, string> = {};
  if (filters.year != null && filters.year !== '') params.year = String(filters.year);
  if (filters.quarter != null && filters.quarter !== '') params.quarter = String(filters.quarter);
  if (filters.companyId) params.companyId = String(filters.companyId);
  return apiGet('/api/v1/vat-planning/registry', params);
}

export async function upsertVatPlanning(body: unknown): Promise<ApiParsedResult> {
  return apiPut('/api/v1/vat-planning', body);
}

export async function deleteVatPlanning(
  companyId: string,
  year: string | number,
  quarter: string | number,
): Promise<ApiParsedResult> {
  const qs = `companyId=${encodeURIComponent(companyId)}&year=${encodeURIComponent(String(year))}&quarter=${encodeURIComponent(String(quarter))}`;
  return apiDelete(`/api/v1/vat-planning?${qs}`);
}

/** تحليل فترة: إجماليات حسب نوع الفاتورة + أعلى موردين — يتطلب REPORTS_READ */
export async function getPeriodAnalytics(
  companyId: string,
  startDate: unknown,
  endDate: unknown,
): Promise<ApiParsedResult> {
  const params: Record<string, string> = {
    companyId: String(companyId),
    startDate: String(startDate || '').slice(0, 10),
    endDate: String(endDate || '').slice(0, 10),
  };
  const res = await apiGet('/api/v1/reports/period-analytics', params);
  if (!res.success) return res;
  const raw = res.data?.data ?? res.data;
  return { success: true, data: raw };
}

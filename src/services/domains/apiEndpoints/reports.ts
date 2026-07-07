import type { ApiParsedResult } from '../../../types/api';
import { apiGet, apiPut, apiDelete } from '../../core/apiHttp';
import {
  generalProfitLossDetailsQuery,
  generalProfitLossQuery,
  generalProfitLossTrendQuery,
  periodAnalyticsQuery,
  taxVatReportQuery,
  vatPlanningDeleteQuery,
  vatPlanningListQuery,
  vatPlanningRegistryQuery,
  withReportsApiQuery,
  type TaxVatReportQueryOptions,
  type VatPlanningRegistryQuery,
} from './reports-query';
import type {
  VatPlanningRecord,
  VatPlanningRegistryMetadata,
  VatPlanningRegistryFilters,
  VatPlanningUpsertPayload,
} from '../../../types/api/domains/hajriTax';
import type {
  GeneralProfitLossReport,
  PeriodAnalyticsData,
  ReportDetailsData,
  ReportTrendData,
  TaxDisclosureData,
} from '../../../modules/Reports/reportTypes';

// ——— التقارير ———
type DataEnvelope<T> = { data?: T };

function isDataEnvelope<T>(value: T | DataEnvelope<T> | undefined): value is DataEnvelope<T> {
  return !!value && typeof value === 'object' && 'data' in value;
}

function unwrapDataEnvelope<T>(value: T | DataEnvelope<T> | undefined): T | undefined {
  return isDataEnvelope(value) ? value.data : value;
}

export async function getGeneralProfitLossReport(
  companyId: string,
  year: string | number,
): Promise<ApiParsedResult<GeneralProfitLossReport>> {
  return apiGet('/api/v1/reports/general-profit-loss', generalProfitLossQuery(companyId, year));
}
export async function getGeneralProfitLossDetails(
  companyId: string,
  year: string | number,
  month: string | number | null | undefined,
  groupKey: string,
  itemKey?: string,
): Promise<ApiParsedResult<ReportDetailsData>> {
  return apiGet(
    '/api/v1/reports/general-profit-loss/details',
    generalProfitLossDetailsQuery(companyId, year, month, groupKey, itemKey),
  );
}
export async function getGeneralProfitLossTrend(
  companyId: string,
  year: string | number,
  groupKey: string,
  itemKey?: string,
): Promise<ApiParsedResult<ReportTrendData>> {
  return apiGet(
    '/api/v1/reports/general-profit-loss/trend',
    generalProfitLossTrendQuery(companyId, year, groupKey, itemKey),
  );
}

/** @param opts — عند salesAmountIncludesVat: true تُفسَّر المبيعات كإجمالٍ شامل 15% */
export async function getTaxVatReport(
  companyId: string,
  year: string | number,
  period: string,
  opts: TaxVatReportQueryOptions = {},
): Promise<ApiParsedResult<TaxDisclosureData>> {
  return apiGet('/api/v1/reports/tax-vat', taxVatReportQuery(companyId, year, period, opts));
}

/** سجل الضريبة التخطيطي (معزول عن المحاسبة) — REPORTS_READ */
export async function getVatPlanningList(
  year: string | number,
  quarter: string | number,
  companyId?: string,
): Promise<ApiParsedResult<VatPlanningRecord[]>> {
  return apiGet('/api/v1/vat-planning', vatPlanningListQuery(year, quarter, companyId));
}

/** جميع الإقرارات المحفوظة مع فلاتر اختيارية — REPORTS_READ */
export async function getVatPlanningRegistry(
  filters: VatPlanningRegistryQuery & VatPlanningRegistryFilters = {},
): Promise<ApiParsedResult<VatPlanningRecord[]>> {
  return apiGet('/api/v1/vat-planning/registry', vatPlanningRegistryQuery(filters));
}

export async function getVatPlanningRegistryMetadata(): Promise<ApiParsedResult<VatPlanningRegistryMetadata>> {
  return apiGet('/api/v1/vat-planning/registry/metadata');
}

export async function upsertVatPlanning(body: VatPlanningUpsertPayload): Promise<ApiParsedResult<VatPlanningRecord>> {
  return apiPut('/api/v1/vat-planning', body);
}

export async function deleteVatPlanning(
  companyId: string,
  year: string | number,
  quarter: string | number,
): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete(withReportsApiQuery('/api/v1/vat-planning', vatPlanningDeleteQuery(companyId, year, quarter)));
}

/** تحليل فترة: إجماليات حسب نوع الفاتورة + أعلى موردين — يتطلب REPORTS_READ */
export async function getPeriodAnalytics(
  companyId: string,
  startDate: unknown,
  endDate: unknown,
): Promise<ApiParsedResult<PeriodAnalyticsData>> {
  const res = await apiGet<PeriodAnalyticsData | { data?: PeriodAnalyticsData }>('/api/v1/reports/period-analytics', periodAnalyticsQuery(companyId, startDate, endDate));
  if (!res.success) return { success: false, error: res.error };
  const raw = unwrapDataEnvelope(res.data);
  return { success: true, data: raw };
}

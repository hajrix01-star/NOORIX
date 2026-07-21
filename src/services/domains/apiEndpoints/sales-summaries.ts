import type { ApiParsedResult } from '../../../types/api';
import type {
  CreateSalesSummaryBody,
  DailySalesBatchPayload,
  SalesListShiftFilter,
  SalesMutationResult,
  SalesSummariesPage,
  SalesSummaryItem,
  SalesSummaryPageSummary,
  UpdateSalesSummaryBody,
} from '../../../types/api/domains/sales';
import { toYmd } from '../../../utils/saudiDate';
import { apiGet, apiPost, apiPatch, apiDelete, throwIfApiFailed } from '../../core/apiHttp';
import { postDailySalesSummaryBatch } from './sales-summaries-batch';
import { listShiftFilterToApiParam } from '../../../modules/Sales/constants/salesShift';
import { buildPurchaseBatchSummariesApiQuery } from './purchase-batch-query';
import type { DashboardSalesPackData } from '../../../types/api/domains/dashboard';
import type {
  PurchaseBatchInvoice,
  PurchaseBatchStatus,
} from '../../../modules/Purchases/batch/purchaseBatchTypes';

// ——— ملخصات المبيعات اليومية ———
export async function createDailySalesSummary(body: CreateSalesSummaryBody | Record<string, unknown>): Promise<ApiParsedResult<SalesMutationResult>> {
  return apiPost('/api/v1/sales/summary', body);
}

export async function createDailySalesSummaryBatch(body: DailySalesBatchPayload): Promise<ApiParsedResult<SalesMutationResult>> {
  const batch = body;
  if (!Array.isArray(batch?.items) || batch.items.length === 0) {
    return { success: false, error: 'لا توجد ملخصات للحفظ' };
  }

  return postDailySalesSummaryBatch(batch);
}

export type { DailySalesBatchPayload, DailySalesBatchItem } from '../../../types/api/domains/sales';
type PurchaseBatchSummariesResult = {
  batches: Array<{
    batchId: string;
    invoices?: PurchaseBatchInvoice[] | null;
    transactionDate: string;
    invoiceCount: number;
    supplierNames?: string | null;
    vaultName?: string | null;
    netAmount?: number | string | null;
    taxAmount?: number | string | null;
    totalAmount?: number | string | null;
    status: PurchaseBatchStatus;
  }>;
  rowCount: number;
};
type SalesSummariesApiResponse = SalesSummariesPage | { data?: SalesSummariesPage };
type PurchaseBatchSummariesApiResponse = PurchaseBatchSummariesResult | { data?: PurchaseBatchSummariesResult };

type DataEnvelope<T> = { data?: T };

function isDataEnvelope<T>(value: T | DataEnvelope<T> | undefined): value is DataEnvelope<T> {
  return !!value && typeof value === 'object' && 'data' in value;
}

function unwrapDataEnvelope<T>(value: T | DataEnvelope<T> | undefined): T | undefined {
  return isDataEnvelope(value) ? value.data : value;
}
export async function updateDailySalesSummary(
  id: string,
  body: UpdateSalesSummaryBody,
  companyId: string,
): Promise<ApiParsedResult<SalesMutationResult>> {
  return apiPatch(`/api/v1/sales/summaries/${id}?companyId=${companyId}`, body);
}
export async function cancelDailySalesSummary(id: string, companyId: string): Promise<ApiParsedResult<{ success?: boolean }>> {
  return apiDelete(`/api/v1/sales/summaries/${id}?companyId=${companyId}`);
}
export async function deleteDailySalesSummary(id: string, companyId: string): Promise<ApiParsedResult<{ success?: boolean }>> {
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
  baselineStart,
  baselineEnd,
}: {
  companyId: string;
  yearStart: string;
  yearEnd: string;
  dailyStart?: string;
  dailyEnd?: string;
  monthStart?: string;
  monthEnd?: string;
  baselineStart?: string;
  baselineEnd?: string;
}): Promise<ApiParsedResult<DashboardSalesPackData>> {
  const params: Record<string, string> = {
    companyId: String(companyId),
    yearStart: toYmd(yearStart),
    yearEnd: toYmd(yearEnd),
  };
  if (dailyStart) params.dailyStart = toYmd(dailyStart);
  if (dailyEnd) params.dailyEnd = toYmd(dailyEnd);
  if (monthStart) params.monthStart = toYmd(monthStart);
  if (monthEnd) params.monthEnd = toYmd(monthEnd);
  if (baselineStart) params.baselineStart = toYmd(baselineStart);
  if (baselineEnd) params.baselineEnd = toYmd(baselineEnd);
  return apiGet('/api/v1/sales/summaries/dashboard-pack', params);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isSalesPageSummary(value: unknown): value is SalesSummaryPageSummary {
  if (!isObjectRecord(value)) return false;
  return ['rowCount', 'customerCount', 'totalAmount', 'avgPerCustomer']
    .every((key) => typeof value[key] === 'number');
}

export async function getDailySalesSummaries(
  companyId: string,
  startDate?: string,
  endDate?: string,
  page: number = 1,
  pageSize: number = 50,
  q?: string,
  sortBy?: string,
  sortDir?: string,
  includeCancelled?: boolean,
  shift?: SalesListShiftFilter,
): Promise<ApiParsedResult<SalesSummariesPage>> {
  const size = Math.min(200, Math.max(1, Number(pageSize) || 50));
  const params: Record<string, string> = {
    companyId: String(companyId),
    page: String(page),
    pageSize: String(size),
  };
  if (startDate) params.startDate = toYmd(startDate);
  if (endDate) params.endDate = toYmd(endDate);
  if (q && String(q).trim()) params.q = String(q).trim();
  if (sortBy) params.sortBy = sortBy;
  if (sortDir) params.sortDir = sortDir;
  if (includeCancelled) params.includeCancelled = '1';
  const shiftParam = shift != null ? listShiftFilterToApiParam(shift) : undefined;
  if (shiftParam) params.shift = shiftParam;
  const res = await apiGet<SalesSummariesApiResponse>('/api/v1/sales/summaries', params);
  if (!res.success) return { success: false, error: res.error };
  const raw = unwrapDataEnvelope(res.data);
  if (!isObjectRecord(raw)) {
    return { success: false, error: 'استجابة ملخصات المبيعات غير مطابقة للعقد الرسمي' };
  }
  const items = raw.items;
  if (!Array.isArray(items) || !Array.isArray(raw.dayRows) || !isSalesPageSummary(raw.pageSummary)) {
    return { success: false, error: 'استجابة ملخصات المبيعات ناقصة: dayRows/pageSummary مطلوبة من الباكند' };
  }
  const total = Number(raw.total);
  const responsePage = Number(raw.page);
  const responsePageSize = Number(raw.pageSize);
  return {
    success: true,
    data: {
      items,
      dayRows: raw.dayRows,
      pageSummary: raw.pageSummary,
      total: Number.isFinite(total) ? total : items.length,
      page: Number.isFinite(responsePage) ? responsePage : page,
      pageSize: Number.isFinite(responsePageSize) ? responsePageSize : size,
    },
  };
}

/** جلب كل ملخصات المبيعات في الفترة — للتصدير والطباعة */
export async function fetchAllSalesSummariesForExport(
  companyId: string,
  startDate: string | undefined,
  endDate: string | undefined,
  q: string | undefined,
  sortBy: string = 'transactionDate',
  sortDir: string = 'desc',
  includeCancelled: boolean = true,
  shift: SalesListShiftFilter = 'any',
): Promise<SalesSummaryItem[]> {
  const pageSize = 150;
  let page = 1;
  const acc: SalesSummaryItem[] = [];
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
      shift,
    );
    throwIfApiFailed(res, 'فشل تحميل ملخصات المبيعات للتصدير');
    const pack = res.data;
    const { items = [], total = 0 } = pack || {};
    acc.push(...items);
    const t = Number(total) || 0;
    if (acc.length >= t || items.length < pageSize) break;
    page += 1;
  }
  return acc;
}

/** ملخص دفعات المشتريات في الفترة — من السيرفر (بدل صفحة فواتير واحدة) */
export async function getPurchaseBatchSummaries(
  companyId: string,
  startDate?: string,
  endDate?: string,
  q?: string,
  lang?: string,
): Promise<ApiParsedResult<PurchaseBatchSummariesResult>> {
  const params = buildPurchaseBatchSummariesApiQuery({ companyId, startDate, endDate, q, lang });
  const res = await apiGet<PurchaseBatchSummariesApiResponse>('/api/v1/invoices/purchase-batch-summaries', params);
  if (!res.success) return { success: false, error: res.error, data: { batches: [], rowCount: 0 } };
  const raw = unwrapDataEnvelope(res.data);
  return {
    success: true,
    data: {
      batches: Array.isArray(raw?.batches) ? raw.batches : [],
      rowCount: Number(raw?.rowCount) || 0,
    },
  };
}

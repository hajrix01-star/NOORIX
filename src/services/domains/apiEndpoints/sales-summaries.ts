import type { ApiParsedResult } from '../../../types/api';
import { toYmd } from '../../../utils/saudiDate';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';
import {
  createDailySalesSummariesSequential,
  postDailySalesSummaryBatch,
  type DailySalesBatchPayload,
} from './sales-summaries-batch';
import { postSalesSummaryWithCompat } from '../../../modules/Sales/utils/salesApiCompat';
import type { SalesListShiftFilter } from '../../../modules/Sales/constants/salesShift';
import { listShiftFilterToApiParam } from '../../../modules/Sales/constants/salesShift';

// ——— ملخصات المبيعات اليومية ———
export async function createDailySalesSummary(body: unknown): Promise<ApiParsedResult> {
  return postSalesSummaryWithCompat(body as Record<string, unknown>);
}

export async function createDailySalesSummaryBatch(body: unknown): Promise<ApiParsedResult> {
  const batch = body as DailySalesBatchPayload;
  if (!Array.isArray(batch?.items) || batch.items.length === 0) {
    return { success: false, error: 'لا توجد ملخصات للحفظ' };
  }

  const useBatchRoute = import.meta.env.VITE_SALES_USE_BATCH === 'true';
  if (useBatchRoute && batch.items.length > 1) {
    const res = await postDailySalesSummaryBatch(batch);
    if (res.success) return res;
    if (res.code !== 404) return res;
  }

  return createDailySalesSummariesSequential(batch);
}

export { createDailySalesSummariesSequential } from './sales-summaries-batch';
export type { DailySalesBatchPayload, DailySalesBatchItem } from './sales-summaries-batch';
export async function updateDailySalesSummary(
  id: string,
  body: unknown,
  companyId: string,
): Promise<ApiParsedResult> {
  return apiPatch(`/api/v1/sales/summaries/${id}?companyId=${companyId}`, body);
}
export async function cancelDailySalesSummary(id: string, companyId: string): Promise<ApiParsedResult> {
  return apiDelete(`/api/v1/sales/summaries/${id}?companyId=${companyId}`);
}
export async function deleteDailySalesSummary(id: string, companyId: string): Promise<ApiParsedResult> {
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
}: {
  companyId: string;
  yearStart: string;
  yearEnd: string;
  dailyStart?: string;
  dailyEnd?: string;
  monthStart?: string;
  monthEnd?: string;
}): Promise<ApiParsedResult> {
  const params: Record<string, string> = {
    companyId: String(companyId),
    yearStart: toYmd(yearStart),
    yearEnd: toYmd(yearEnd),
  };
  if (dailyStart) params.dailyStart = toYmd(dailyStart);
  if (dailyEnd) params.dailyEnd = toYmd(dailyEnd);
  if (monthStart) params.monthStart = toYmd(monthStart);
  if (monthEnd) params.monthEnd = toYmd(monthEnd);
  return apiGet('/api/v1/sales/summaries/dashboard-pack', params);
}

export async function getDailySalesSummaries(
  companyId: string,
  startDate?: string,
  endDate?: string,
  page: any = 1,
  pageSize: any = 50,
  q?: string,
  sortBy?: string,
  sortDir?: string,
  includeCancelled?: boolean,
  shift?: SalesListShiftFilter,
): Promise<ApiParsedResult> {
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
  companyId: string,
  startDate: string | undefined,
  endDate: string | undefined,
  q: string | undefined,
  sortBy: any = 'transactionDate',
  sortDir: any = 'desc',
  includeCancelled: any = true,
  shift: SalesListShiftFilter = 'any',
): Promise<unknown[]> {
  const pageSize = 150;
  let page = 1;
  const acc: unknown[] = [];
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
    if (!res?.success) break;
    const pack = res.data as { items?: unknown[]; total?: number } | undefined;
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
): Promise<ApiParsedResult> {
  const params: Record<string, string> = { companyId: String(companyId) };
  if (startDate) params.startDate = toYmd(startDate);
  if (endDate) params.endDate = toYmd(endDate);
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

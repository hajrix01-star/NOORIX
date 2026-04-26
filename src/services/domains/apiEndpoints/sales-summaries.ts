import { apiGet, apiPost, apiPatch, apiDelete } from '../../core/apiHttp';

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
}: {
  companyId: string;
  yearStart: string;
  yearEnd: string;
  dailyStart?: string;
  dailyEnd?: string;
  monthStart?: string;
  monthEnd?: string;
}) {
  const params: Record<string, string> = {
    companyId: String(companyId),
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
  companyId: string,
  startDate?: string,
  endDate?: string,
  page = 1,
  pageSize = 50,
  q?: string,
  sortBy?: string,
  sortDir?: string,
  includeCancelled?: boolean,
) {
  const size = Math.min(200, Math.max(1, Number(pageSize) || 50));
  const params: Record<string, string> = {
    companyId: String(companyId),
    page: String(page),
    pageSize: String(size),
  };
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
export async function getPurchaseBatchSummaries(
  companyId: string,
  startDate?: string,
  endDate?: string,
  q?: string,
  lang?: string,
) {
  const params: Record<string, string> = { companyId: String(companyId) };
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

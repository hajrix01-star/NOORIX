/**
 * حفظ دفعة ملخصات — متسلسل عبر /summary (متوافق مع خادم بدون summary-batch).
 */
import type { ApiParsedResult } from '../../../types/api';
import { toYmd } from '../../../utils/saudiDate';
import { apiPost } from '../../core/apiHttp';
import {
  buildCreateSalesSummaryApiBody,
  type CreateSalesSummaryBodyInput,
} from '../../../modules/Sales/utils/salesApiPayload';

export type DailySalesBatchItem = {
  shift: string;
  customerCount: number;
  cashOnHand?: string;
  channels: { vaultId: string; amount: string }[];
  notes?: string;
};

export type DailySalesBatchPayload = {
  companyId: string;
  transactionDate: string;
  items: DailySalesBatchItem[];
  batchIdempotencyKey?: string;
};

function extractSummaryFromInflowResponse(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  const d = data as { summary?: unknown };
  return d.summary ?? data;
}

function itemToBodyInput(
  batch: DailySalesBatchPayload,
  item: DailySalesBatchItem,
  index: number,
): CreateSalesSummaryBodyInput {
  return {
    companyId: batch.companyId,
    transactionDate: batch.transactionDate,
    customerCount: item.customerCount,
    shift: item.shift,
    cashOnHand: item.cashOnHand,
    channels: item.channels,
    notes: item.notes,
    idempotencyKey: batch.batchIdempotencyKey
      ? `${batch.batchIdempotencyKey}-${item.shift}-${index}`
      : undefined,
    omitIdempotencyKey: true,
  };
}

export function buildBatchItemApiPayload(
  batch: DailySalesBatchPayload,
  item: DailySalesBatchItem,
  index: number,
): Record<string, unknown> {
  return buildCreateSalesSummaryApiBody(itemToBodyInput(batch, item, index));
}

/** حفظ متسلسل — طلب /summary لكل شفت */
export async function createDailySalesSummariesSequential(
  body: DailySalesBatchPayload,
): Promise<ApiParsedResult<{ summaries: unknown[] }>> {
  const summaries: unknown[] = [];

  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    const payload = buildBatchItemApiPayload(body, item, i);
    const res = await apiPost('/api/v1/sales/summary', payload);
    if (!res.success) {
      return {
        success: false,
        error: res.error ?? 'فشل حفظ أحد الملخصات',
        code: res.code,
      };
    }
    summaries.push(extractSummaryFromInflowResponse(res.data));
  }

  return { success: true, data: { summaries } };
}

/** POST /sales/summary-batch — عند تفعيل VITE_SALES_USE_BATCH */
export async function postDailySalesSummaryBatch(
  body: DailySalesBatchPayload,
): Promise<ApiParsedResult<{ summaries: unknown[] }>> {
  const items = body.items.map((item, i) => buildBatchItemApiPayload(body, item, i));
  const res = await apiPost('/api/v1/sales/summary-batch', {
    companyId: body.companyId,
    transactionDate: toYmd(body.transactionDate) || body.transactionDate,
    items: items.map((p) => ({
      shift: p.shift as string,
      customerCount: p.customerCount as number,
      cashOnHand: p.cashOnHand as string,
      channels: p.channels as { vaultId: string; amount: string }[],
      notes: p.notes as string | undefined,
    })),
    batchIdempotencyKey: body.batchIdempotencyKey,
  });
  if (!res.success) return res as ApiParsedResult<{ summaries: unknown[] }>;
  const raw = res.data as { summaries?: unknown[] } | undefined;
  const summaries = raw?.summaries ?? (Array.isArray(raw) ? raw : []);
  return { success: true, data: { summaries } };
}

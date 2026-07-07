import type { ApiParsedResult } from '../../../types/api';
import type {
  DailySalesBatchItem,
  DailySalesBatchPayload,
  SalesSummaryItem,
} from '../../../types/api/domains/sales';
import { toYmd } from '../../../utils/saudiDate';
import { apiPost } from '../../core/apiHttp';
import {
  buildCreateSalesSummaryApiBody,
  type CreateSalesSummaryBodyInput,
} from '../../../modules/Sales/utils/salesApiPayload';

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

export async function postDailySalesSummaryBatch(
  body: DailySalesBatchPayload,
): Promise<ApiParsedResult<{ summaries: SalesSummaryItem[] }>> {
  const items = body.items.map((item, i) => buildBatchItemApiPayload(body, item, i));
  const res = await apiPost<{ summaries?: SalesSummaryItem[] } | SalesSummaryItem[]>('/api/v1/sales/summary-batch', {
    companyId: body.companyId,
    transactionDate: toYmd(body.transactionDate) || body.transactionDate,
    items: items.map((p) => ({
      shift: String(p.shift),
      customerCount: Number(p.customerCount),
      cashOnHand: String(p.cashOnHand ?? '0'),
      channels: Array.isArray(p.channels) ? p.channels : [],
      notes: typeof p.notes === 'string' ? p.notes : undefined,
    })),
    batchIdempotencyKey: body.batchIdempotencyKey,
  });
  if (!res.success) return { success: false, error: res.error };
  const raw = res.data as { summaries?: SalesSummaryItem[] } | undefined;
  const summaries = raw?.summaries ?? (Array.isArray(raw) ? raw : []);
  return { success: true, data: { summaries } };
}

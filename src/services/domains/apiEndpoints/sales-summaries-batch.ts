/**
 * حفظ دفعة ملخصات — يحاول summary-batch ثم يتراجع لطلبات summary منفصلة عند 404 (خادم قديم).
 */
import type { ApiParsedResult } from '../../../types/api';
import { apiPost } from '../../core/apiHttp';

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

/** حفظ متسلسل عند غياب endpoint الدفعة على الخادم */
export async function createDailySalesSummariesSequential(
  body: DailySalesBatchPayload,
): Promise<ApiParsedResult<{ summaries: unknown[] }>> {
  const summaries: unknown[] = [];
  const baseKey = body.batchIdempotencyKey;

  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    const res = await apiPost('/api/v1/sales/summary', {
      companyId: body.companyId,
      transactionDate: body.transactionDate,
      customerCount: item.customerCount,
      shift: item.shift,
      cashOnHand: item.cashOnHand ?? '0',
      channels: item.channels,
      notes: item.notes,
      idempotencyKey: baseKey ? `${baseKey}-${item.shift}-${i}` : undefined,
    });
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

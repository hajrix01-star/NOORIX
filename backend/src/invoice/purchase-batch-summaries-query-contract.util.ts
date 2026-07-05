import { toYmd } from '../common/utils/to-ymd.util';
import type { PurchaseBatchSummariesQueryDto } from './dto/purchase-batch-summaries-query.dto';

const PURCHASE_BATCH_QUERY_MAX_LENGTH = 120;

export type PurchaseBatchSummariesQueryContract = {
  companyId: string;
  startDate?: string;
  endDate?: string;
  q?: string;
  lang: string;
};

export function normalizePurchaseBatchSummariesQuery(
  companyId: string,
  query: PurchaseBatchSummariesQueryDto,
): PurchaseBatchSummariesQueryContract {
  return {
    companyId,
    startDate: optionalYmd(query.startDate),
    endDate: optionalYmd(query.endDate),
    q: optionalString(query.q)?.slice(0, PURCHASE_BATCH_QUERY_MAX_LENGTH),
    lang: normalizeLang(query.lang),
  };
}

function optionalString(value: unknown): string | undefined {
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
}

function optionalYmd(value: unknown): string | undefined {
  const ymd = value != null && value !== '' ? toYmd(value) : '';
  return ymd || undefined;
}

function normalizeLang(value: unknown): string {
  return optionalString(value) === 'en' ? 'en' : 'ar';
}

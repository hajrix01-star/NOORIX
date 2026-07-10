import { toYmd } from '../../../utils/saudiDate';

const PURCHASE_BATCH_QUERY_MAX_LENGTH = 120;

export type PurchaseBatchSummariesQuerySource = {
  companyId: string;
  startDate?: string | null;
  endDate?: string | null;
  q?: string | null;
  lang?: string | null;
};

export type PurchaseBatchSummariesQueryInput = {
  companyId: string;
  startDate: string | null;
  endDate: string | null;
  q: string;
  lang: string;
};

export function normalizePurchaseBatchSummariesQueryInput(
  source: PurchaseBatchSummariesQuerySource,
): PurchaseBatchSummariesQueryInput {
  return {
    companyId: String(source.companyId ?? '').trim(),
    startDate: optionalYmd(source.startDate) ?? null,
    endDate: optionalYmd(source.endDate) ?? null,
    q: optionalString(source.q)?.slice(0, PURCHASE_BATCH_QUERY_MAX_LENGTH) ?? '',
    lang: source.lang === 'en' ? 'en' : 'ar',
  };
}

export function buildPurchaseBatchSummariesApiQuery(
  source: PurchaseBatchSummariesQuerySource,
): Record<string, string> {
  const normalized = normalizePurchaseBatchSummariesQueryInput(source);
  const params: Record<string, string> = {
    companyId: normalized.companyId,
    lang: normalized.lang,
  };
  addOptional(params, 'startDate', normalized.startDate);
  addOptional(params, 'endDate', normalized.endDate);
  addOptional(params, 'q', normalized.q);
  return params;
}

function optionalString(value: unknown): string | undefined {
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
}

function optionalYmd(value: unknown): string | undefined {
  const ymd = value != null && value !== '' ? toYmd(value) : '';
  return ymd || undefined;
}

function addOptional(params: Record<string, string>, key: string, value: string | null) {
  if (value) params[key] = value;
}

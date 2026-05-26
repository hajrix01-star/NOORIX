import { toYmd } from '../../../utils/saudiDate';
import { roundMoney2 } from '../../../utils/moneyInput';

/** مبلغ بصيغة يقبلها الخادم: `^\d+(\.\d{1,2})?$` */
export function formatSalesApiAmount(value: unknown): string {
  if (value == null || value === '') return '';
  const n = roundMoney2(
    typeof value === 'string' ? value.replace(/,/g, '').trim() : value,
  );
  if (!Number.isFinite(n) || n <= 0) return '';
  if (Number.isInteger(n)) return String(n);
  const fixed = n.toFixed(2);
  if (fixed.endsWith('.00')) return String(Math.trunc(n));
  if (fixed.endsWith('0')) return fixed.slice(0, -1);
  return fixed;
}

export type SalesSummaryChannelPayload = { vaultId: string; amount: string };

export function normalizeSalesSummaryChannels(
  channels: SalesSummaryChannelPayload[],
): SalesSummaryChannelPayload[] {
  return channels
    .map((ch) => ({
      vaultId: String(ch.vaultId),
      amount: formatSalesApiAmount(ch.amount),
    }))
    .filter((ch) => ch.amount);
}

export type CreateSalesSummaryBodyInput = {
  companyId: string;
  transactionDate: string;
  customerCount: number;
  shift: string;
  cashOnHand?: string;
  channels: SalesSummaryChannelPayload[];
  notes?: string;
  idempotencyKey?: string;
  /** بدون idempotencyKey — توافق خادم قديم */
  omitIdempotencyKey?: boolean;
};

/** جسم طلب POST /sales/summary بعد التطبيع */
export function buildCreateSalesSummaryApiBody(input: CreateSalesSummaryBodyInput): Record<string, unknown> {
  const channels = normalizeSalesSummaryChannels(input.channels);
  const body: Record<string, unknown> = {
    companyId: String(input.companyId),
    transactionDate: toYmd(input.transactionDate) || input.transactionDate,
    customerCount: Math.max(0, Math.trunc(Number(input.customerCount) || 0)),
    shift: input.shift,
    cashOnHand: formatSalesApiAmount(input.cashOnHand || '0') || '0',
    channels,
  };
  const notes = input.notes?.trim();
  if (notes) body.notes = notes;
  if (!input.omitIdempotencyKey && input.idempotencyKey) {
    body.idempotencyKey = input.idempotencyKey;
  }
  return body;
}

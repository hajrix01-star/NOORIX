import { fmt } from '../../../utils/format';
import { toYmd } from '../../../utils/saudiDate';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import type { DailySalesChannelEntry, DailySalesVaultRef } from '../components/DailySalesChannelsChips';

export type SalesSummaryChannelsLike = {
  status?: string;
  transactionDate?: string | null;
  shift?: unknown;
  notes?: unknown;
  totalAmount?: number | string | null;
  channels?: DailySalesChannelEntry[] | null;
};

export function buildVaultLookup(
  salesChannels: Array<{
    id: string;
    nameAr?: string | null;
    nameEn?: string | null;
    sortOrder?: number | null;
    type?: string | null;
  }>,
): Map<string, DailySalesVaultRef> {
  const map = new Map<string, DailySalesVaultRef>();
  for (const v of salesChannels) {
    map.set(v.id, {
      id: v.id,
      nameAr: v.nameAr,
      nameEn: v.nameEn,
      sortOrder: v.sortOrder,
      type: v.type ?? null,
    });
  }
  return map;
}

export function resolveChannelVaultRef(
  ch: DailySalesChannelEntry,
  vaultById?: Map<string, DailySalesVaultRef>,
): DailySalesVaultRef | null {
  if (ch.vault) return ch.vault;
  const id = ch.vaultId;
  if (id && vaultById?.has(id)) return vaultById.get(id)!;
  return null;
}

function aggregateDayChannelBuckets(
  summaries: SalesSummaryChannelsLike[],
  dayYmd: string,
  lang: string,
  vaultById?: Map<string, DailySalesVaultRef>,
): Array<{ vault: DailySalesVaultRef | null; amount: number; sortOrder: number }> {
  const day = toYmd(dayYmd);
  if (!day) return [];

  const buckets = new Map<string, { vault: DailySalesVaultRef | null; amount: number; sortOrder: number }>();
  for (const s of summaries) {
    if (s.status === 'cancelled') continue;
    if (toYmd(s.transactionDate) !== day) continue;

    for (const ch of s.channels || []) {
      const vault = resolveChannelVaultRef(ch, vaultById);
      const bucketKey = ch.vaultId ?? ch.vault?.id ?? `n:${vaultDisplayName(vault, lang)}`;
      const amount = Number(ch.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      const prev = buckets.get(bucketKey);
      if (prev) {
        prev.amount += amount;
        if (!prev.vault && vault) prev.vault = vault;
      } else {
        buckets.set(bucketKey, { vault, amount, sortOrder: vault?.sortOrder ?? 0 });
      }
    }
  }

  return [...buckets.values()].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder
      || String(a.vault?.nameAr || '').localeCompare(String(b.vault?.nameAr || ''), 'ar'),
  );
}

export function aggregateDayChannelWhatsAppSummary(
  summaries: SalesSummaryChannelsLike[],
  dayYmd: string,
  lang: string,
  vaultById?: Map<string, DailySalesVaultRef>,
): string {
  return aggregateDayChannelBuckets(summaries, dayYmd, lang, vaultById)
    .map((bucket) => `${vaultDisplayName(bucket.vault, lang)}: ${fmt(bucket.amount)}`)
    .join(' | ');
}

export function channelsFromEntryPayload(
  payload: { channels: { vaultId: string; amount: string }[] },
  salesChannels: Array<{ id: string; nameAr?: string | null; nameEn?: string | null; sortOrder?: number | null }>,
): DailySalesChannelEntry[] {
  const vaultById = buildVaultLookup(salesChannels);
  return payload.channels.map((ch) => ({
    vaultId: ch.vaultId,
    amount: ch.amount,
    vault: vaultById.get(ch.vaultId) ?? null,
  }));
}

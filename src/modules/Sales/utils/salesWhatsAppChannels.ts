import { fmt } from '../../../utils/format';
import { vaultDisplayName } from '../../../utils/vaultDisplay';
import { waChannelRow } from '../../../utils/whatsappTextFormat';
import type { DailySalesChannelEntry, DailySalesVaultRef } from '../components/DailySalesChannelsChips';
import type { SalesShiftValue } from '../constants/salesShift';
import { resolveSalesSummaryShift } from '../constants/salesShift';
import { toYmd } from '../../../utils/saudiDate';

export type SalesSummaryChannelsLike = {
  status?: string;
  transactionDate?: string | null;
  shift?: unknown;
  notes?: unknown;
  channels?: DailySalesChannelEntry[] | null;
};

export function buildVaultLookup(
  salesChannels: Array<{ id: string; nameAr?: string | null; nameEn?: string | null; sortOrder?: number | null; type?: string | null }>,
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
  const id = ch.vaultId ?? ch.vault?.id;
  if (id && vaultById?.has(id)) return vaultById.get(id)!;
  return null;
}

/** أسطر واتساب لقنوات ملخص واحد */
export function buildSummaryChannelWhatsAppLines(
  channels: DailySalesChannelEntry[] | null | undefined,
  lang: string,
  vaultById?: Map<string, DailySalesVaultRef>,
): string[] {
  const list = Array.isArray(channels) ? channels : [];
  const lines: string[] = [];
  const sorted = [...list].sort(
    (a, b) =>
      (resolveChannelVaultRef(a, vaultById)?.sortOrder ?? 0)
        - (resolveChannelVaultRef(b, vaultById)?.sortOrder ?? 0)
      || String(resolveChannelVaultRef(a, vaultById)?.nameAr || '').localeCompare(
        String(resolveChannelVaultRef(b, vaultById)?.nameAr || ''),
        'ar',
      ),
  );
  for (const ch of sorted) {
    const amt = Number(ch.amount || 0);
    if (amt <= 0) continue;
    const label = vaultDisplayName(resolveChannelVaultRef(ch, vaultById), lang);
    lines.push(waChannelRow(label, fmt(amt)));
  }
  return lines;
}

/** تجميع قنوات البيع لشفت معيّن في يوم واحد */
export function aggregateShiftChannelWhatsAppLines(
  summaries: SalesSummaryChannelsLike[],
  dayYmd: string,
  shift: SalesShiftValue,
  lang: string,
  vaultById?: Map<string, DailySalesVaultRef>,
): string[] {
  const day = toYmd(dayYmd);
  if (!day) return [];

  const buckets = new Map<string, { vault: DailySalesVaultRef | null; amount: number; sortOrder: number }>();

  for (const s of summaries) {
    if (s.status === 'cancelled') continue;
    if (toYmd(s.transactionDate) !== day) continue;
    const sShift = resolveSalesSummaryShift(s);
    if (sShift !== shift) continue;

    for (const ch of s.channels || []) {
      const vault = resolveChannelVaultRef(ch, vaultById);
      const bucketKey = ch.vaultId ?? ch.vault?.id ?? `n:${vaultDisplayName(vault, lang)}`;
      const amt = Number(ch.amount || 0);
      if (amt <= 0) continue;
      const sortOrder = vault?.sortOrder ?? 0;
      const prev = buckets.get(bucketKey);
      if (prev) {
        prev.amount += amt;
        if (!prev.vault && vault) prev.vault = vault;
      } else {
        buckets.set(bucketKey, { vault, amount: amt, sortOrder });
      }
    }
  }

  return [...buckets.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || String(a.vault?.nameAr || '').localeCompare(String(b.vault?.nameAr || ''), 'ar'))
    .map((b) => waChannelRow(vaultDisplayName(b.vault, lang), fmt(b.amount)));
}

/** تجميع قنوات البيع لكل ملخصات اليوم (قسم الإجمالي) */
export function aggregateDayChannelWhatsAppLines(
  summaries: SalesSummaryChannelsLike[],
  dayYmd: string,
  lang: string,
  vaultById?: Map<string, DailySalesVaultRef>,
): string[] {
  const day = toYmd(dayYmd);
  if (!day) return [];

  const buckets = new Map<string, { vault: DailySalesVaultRef | null; amount: number; sortOrder: number }>();

  for (const s of summaries) {
    if (s.status === 'cancelled') continue;
    if (toYmd(s.transactionDate) !== day) continue;

    for (const ch of s.channels || []) {
      const vault = resolveChannelVaultRef(ch, vaultById);
      const bucketKey = ch.vaultId ?? ch.vault?.id ?? `n:${vaultDisplayName(vault, lang)}`;
      const amt = Number(ch.amount || 0);
      if (amt <= 0) continue;
      const sortOrder = vault?.sortOrder ?? 0;
      const prev = buckets.get(bucketKey);
      if (prev) {
        prev.amount += amt;
        if (!prev.vault && vault) prev.vault = vault;
      } else {
        buckets.set(bucketKey, { vault, amount: amt, sortOrder });
      }
    }
  }

  return [...buckets.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || String(a.vault?.nameAr || '').localeCompare(String(b.vault?.nameAr || ''), 'ar'))
    .map((b) => waChannelRow(vaultDisplayName(b.vault, lang), fmt(b.amount)));
}

/** قنوات من نموذج الإدخال (بعد الحفظ عندما لا تُرجع API القنوات) */
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

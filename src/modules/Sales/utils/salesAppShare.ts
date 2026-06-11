/**
 * نسبة مبيعات التطبيقات من الإجمالي — مصدر موحّد (نفس منطق لوحة التحكم: vault.type === 'app').
 */
import { toYmd } from '../../../utils/saudiDate';
import type { DailySalesChannelEntry, DailySalesVaultRef } from '../components/DailySalesChannelsChips';
import type { SalesShiftValue } from '../constants/salesShift';
import { resolveSalesSummaryShift } from '../constants/salesShift';
import { resolveChannelVaultRef } from './salesWhatsAppChannels';
import type { SalesSummaryChannelsLike } from './salesWhatsAppChannels';

export type AppShareResult = {
  appAmount: number;
  totalAmount: number;
  appPercent: number;
};

export function isAppVaultType(type?: string | null): boolean {
  return type === 'app';
}

export function sumAppFromChannels(
  channels: DailySalesChannelEntry[] | null | undefined,
  vaultById?: Map<string, DailySalesVaultRef>,
): number {
  let app = 0;
  for (const ch of channels || []) {
    const vault = resolveChannelVaultRef(ch, vaultById);
    if (!isAppVaultType(vault?.type)) continue;
    const amt = Number(ch.amount || 0);
    if (Number.isFinite(amt) && amt > 0) app += amt;
  }
  return app;
}

export function computeAppShare(
  channels: DailySalesChannelEntry[] | null | undefined,
  totalAmount: number,
  vaultById?: Map<string, DailySalesVaultRef>,
): AppShareResult {
  const total = Number(totalAmount || 0);
  const appAmount = sumAppFromChannels(channels, vaultById);
  return {
    appAmount,
    totalAmount: total,
    appPercent: total > 0 ? (appAmount / total) * 100 : 0,
  };
}

export type SummaryForAppShare = {
  status?: string;
  transactionDate?: string | null;
  shift?: unknown;
  totalAmount?: number | string | null;
  channels?: DailySalesChannelEntry[] | null;
};

export function computeAppShareFromSummaries(
  summaries: SummaryForAppShare[],
  vaultById?: Map<string, DailySalesVaultRef>,
): AppShareResult {
  let totalAmount = 0;
  let appAmount = 0;
  for (const s of summaries) {
    if (s.status === 'cancelled') continue;
    const total = Number(s.totalAmount || 0);
    if (!Number.isFinite(total) || total <= 0) continue;
    totalAmount += total;
    appAmount += sumAppFromChannels(s.channels, vaultById);
  }
  return {
    appAmount,
    totalAmount,
    appPercent: totalAmount > 0 ? (appAmount / totalAmount) * 100 : 0,
  };
}

function filterDaySummaries(
  summaries: SalesSummaryChannelsLike[],
  dayYmd: string,
  shift?: SalesShiftValue,
): SalesSummaryChannelsLike[] {
  const day = toYmd(dayYmd);
  if (!day) return [];
  return summaries.filter((s) => {
    if (s.status === 'cancelled') return false;
    if (toYmd(s.transactionDate) !== day) return false;
    if (shift == null) return true;
    return resolveSalesSummaryShift(s) === shift;
  });
}

export function computeDayAppShare(
  summaries: SalesSummaryChannelsLike[],
  dayYmd: string,
  vaultById?: Map<string, DailySalesVaultRef>,
): AppShareResult {
  return computeAppShareFromSummaries(filterDaySummaries(summaries, dayYmd), vaultById);
}

export function computeShiftAppShare(
  summaries: SalesSummaryChannelsLike[],
  dayYmd: string,
  shift: SalesShiftValue,
  vaultById?: Map<string, DailySalesVaultRef>,
): AppShareResult {
  return computeAppShareFromSummaries(filterDaySummaries(summaries, dayYmd, shift), vaultById);
}

/** أول وآخر يوم في شهر تاريخ المعاملة (YYYY-MM-DD) */
export function monthRangeForYmd(ymd: string): { start: string; end: string } | null {
  const d = toYmd(ymd);
  if (!d || d.length < 7) return null;
  const year = parseInt(d.slice(0, 4), 10);
  const month = parseInt(d.slice(5, 7), 10);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  };
}

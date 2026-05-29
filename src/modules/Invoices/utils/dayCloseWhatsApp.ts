import { fmt } from '../../../utils/format';
import {
  waChannelRow,
  waMetaLine,
  waMetricLine,
  waReportHeader,
  waShiftSectionTitle,
  waSubheading,
} from '../../../utils/whatsappTextFormat';

export type DayCloseKindLabels = Record<string, string>;

const PURCHASE_KIND = 'purchase';
const EXPENSE_KINDS = new Set(['expense', 'fixed_expense', 'hr_expense', 'salary', 'advance']);

function pickBilingual(lang: string, nameAr?: string | null, nameEn?: string | null): string {
  const ar = nameAr != null && String(nameAr).trim() !== '' ? String(nameAr).trim() : '';
  const en = nameEn != null && String(nameEn).trim() !== '' ? String(nameEn).trim() : '';
  if (lang === 'en') return en || ar || '—';
  return ar || en || '—';
}

function sumByKinds(byKind: any[], kinds: Set<string> | string): number {
  const set = typeof kinds === 'string' ? new Set([kinds]) : kinds;
  return (byKind || []).reduce((s, row) => (set.has(row.kind) ? s + Number(row.total || 0) : s), 0);
}

function countByKinds(byKind: any[], kinds: Set<string> | string): number {
  const set = typeof kinds === 'string' ? new Set([kinds]) : kinds;
  return (byKind || []).reduce((s, row) => (set.has(row.kind) ? s + Number(row.count || 0) : s), 0);
}

function aggregateSalesChannels(salesSummaries: any[], lang: string): { lines: string[]; total: number } {
  const buckets = new Map<string, number>();
  let total = 0;
  for (const s of salesSummaries || []) {
    total += Number(s.totalAmount || 0);
    for (const ch of s.channels || []) {
      const label = pickBilingual(lang, ch.vaultNameAr, ch.vaultNameEn);
      const amt = Number(ch.amount || 0);
      if (amt <= 0) continue;
      buckets.set(label, (buckets.get(label) ?? 0) + amt);
    }
  }
  const lines = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, amt]) => waChannelRow(label, fmt(amt)));
  return { lines, total };
}

function salesCustomersTotal(salesSummaries: any[]): number {
  return (salesSummaries || []).reduce((s, x) => s + Number(x.customerCount || 0), 0);
}

export type BuildDayCloseWhatsAppParams = {
  companyName: string;
  dateLabel: string;
  data: any;
  kindLabel: DayCloseKindLabels;
  lang: string;
  t: (key: string, ...args: unknown[]) => string;
};

/** ملخص واتساب مختصر لنهاية اليوم — نفس رموز ملخص المبيعات (☀ ☾ ◆ │ ▸) */
export function buildDayCloseWhatsAppText(p: BuildDayCloseWhatsAppParams): string {
  const { companyName, dateLabel, data, kindLabel, lang, t } = p;
  const name = (companyName || '').trim();
  const byKind = data.byKind || [];
  const salesSummaries = data.salesSummaries || [];

  const inflowTotal = Number(data.sums?.inflow?.total || 0);
  const outflowTotal = Number(data.sums?.outflow?.total || 0);
  const netDay = inflowTotal - outflowTotal;

  const { lines: channelLines, total: channelsSum } = aggregateSalesChannels(salesSummaries, lang);
  const salesTotal = salesSummaries.length > 0
    ? channelsSum || salesSummaries.reduce((s: number, x: any) => s + Number(x.totalAmount || 0), 0)
    : inflowTotal;
  const customers = salesSummaries.length > 0
    ? salesCustomersTotal(salesSummaries)
    : countByKinds(byKind, 'sale');

  const purchasesTotal = sumByKinds(byKind, PURCHASE_KIND);
  const expensesTotal = sumByKinds(byKind, EXPENSE_KINDS);

  const cashIn = Number(data.cash?.dayTotalIn ?? 0);
  const cashOut = Number(data.cash?.dayTotalOut ?? 0);
  const cashAvailable = Number(data.cash?.netDay ?? cashIn - cashOut);

  const lines: string[] = [
    waReportHeader(t('dayCloseWaTitle'), name),
    waMetaLine(t('dayCloseWaDateLine'), dateLabel),
    '',
    waShiftSectionTitle('morning', t('dayCloseWaSectionSales')),
  ];

  if (salesTotal > 0 || customers > 0) {
    lines.push(waMetricLine(t('dayCloseWaSalesTotal'), `${fmt(salesTotal)} SR`));
    if (channelLines.length > 0) {
      lines.push(waSubheading(t('dayCloseWaChannels')));
      lines.push(...channelLines);
    } else if (byKind.some((r: any) => r.kind === 'sale')) {
      const saleLabel = kindLabel.sale || 'sale';
      lines.push(waMetricLine(t('dayCloseWaFromInvoices'), `${fmt(inflowTotal)} SR (${saleLabel})`));
    }
    if (customers > 0) {
      lines.push(waMetricLine(t('dayCloseWaCustomersLine'), fmt(customers, 0)));
    }
  } else {
    lines.push(`  ${t('dayCloseWaNoSales')}`);
  }

  lines.push('', waShiftSectionTitle('evening', t('dayCloseWaSectionOutflow')));

  if (purchasesTotal > 0) {
    lines.push(waMetricLine(t('dayCloseWaPurchases'), `${fmt(purchasesTotal)} SR`));
  }
  if (expensesTotal > 0) {
    lines.push(waMetricLine(t('dayCloseWaExpenses'), `${fmt(expensesTotal)} SR`));
  }
  if (purchasesTotal <= 0 && expensesTotal <= 0 && outflowTotal > 0) {
    lines.push(waMetricLine(t('dayCloseWaOutflowTotal'), `${fmt(outflowTotal)} SR`));
  } else if (purchasesTotal > 0 || expensesTotal > 0) {
    lines.push(waMetricLine(t('dayCloseWaOutflowTotal'), `${fmt(purchasesTotal + expensesTotal)} SR`));
  } else {
    lines.push(`  ${t('dayCloseWaNoOutflow')}`);
  }

  const netPrefix = netDay >= 0 ? '+' : '';
  lines.push(
    '',
    waShiftSectionTitle('grand', t('dayCloseWaSectionClosing')),
    waMetricLine(t('dayCloseWaNetDay'), `${netPrefix}${fmt(netDay)} SR`),
    waMetricLine(t('dayCloseWaCashIn'), `${fmt(cashIn)} SR`),
    waMetricLine(t('dayCloseWaCashOut'), `${fmt(cashOut)} SR`),
    waMetricLine(t('dayCloseWaCashAvailable'), `${fmt(cashAvailable)} SR`),
    '',
    t('dayCloseWaFooter'),
  );

  return lines.join('\n').trim();
}

export function openDayCloseWhatsApp(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

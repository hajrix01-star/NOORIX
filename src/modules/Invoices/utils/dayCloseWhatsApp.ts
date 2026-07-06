import { fmt } from '../../../utils/format';
import {
  waAvgSaleMetricLine,
  waCashLine,
  waChannelRow,
  waCustomersLine,
  waMetaLine,
  waMetricLine,
  waReportHeader,
  waShiftSectionTitle,
  waSubheading,
} from '../../../utils/whatsappTextFormat';
import {
  type DayCloseKindLabels,
  type DayCloseKindRow,
  type DayCloseReportData,
  type DayCloseSalesSummary,
  pickDayCloseBilingualName,
} from '../dayCloseReportModel';

type Translate = (key: string, ...args: unknown[]) => string;

export type BuildDayCloseWhatsAppParams = {
  companyName: string;
  dateLabel: string;
  data: DayCloseReportData;
  kindLabel: DayCloseKindLabels;
  lang: string;
  t: Translate;
};

const PURCHASE_KIND = 'purchase';
const EXPENSE_KINDS = new Set(['expense', 'fixed_expense', 'hr_expense', 'salary', 'advance']);

function asNumber(value: unknown) {
  return Number(value || 0);
}

function sumByKinds(byKind: DayCloseKindRow[], kinds: Set<string> | string): number {
  const set = typeof kinds === 'string' ? new Set([kinds]) : kinds;
  return byKind.reduce((sum, row) => (row.kind && set.has(row.kind) ? sum + asNumber(row.total) : sum), 0);
}

function countByKinds(byKind: DayCloseKindRow[], kinds: Set<string> | string): number {
  const set = typeof kinds === 'string' ? new Set([kinds]) : kinds;
  return byKind.reduce((sum, row) => (row.kind && set.has(row.kind) ? sum + asNumber(row.count) : sum), 0);
}

function aggregateSalesChannels(salesSummaries: DayCloseSalesSummary[], lang: string) {
  const buckets = new Map<string, { label: string; vaultType: string | null; amount: number }>();
  let total = 0;

  for (const summary of salesSummaries) {
    total += asNumber(summary.totalAmount);
    for (const channel of summary.channels ?? []) {
      const label = pickDayCloseBilingualName(lang, channel.vaultNameAr, channel.vaultNameEn);
      const amount = asNumber(channel.amount);
      if (amount <= 0) continue;

      const vaultType = channel.vaultType != null ? String(channel.vaultType) : null;
      const key = `${vaultType || ''}:${label}`;
      const previous = buckets.get(key);
      if (previous) previous.amount += amount;
      else buckets.set(key, { label, vaultType, amount });
    }
  }

  return {
    lines: [...buckets.values()]
      .sort((left, right) => right.amount - left.amount)
      .map((bucket) => waChannelRow(bucket.label, fmt(bucket.amount))),
    total,
  };
}

function salesCustomersTotal(salesSummaries: DayCloseSalesSummary[]) {
  return salesSummaries.reduce((sum, summary) => sum + asNumber(summary.customerCount), 0);
}

export function buildDayCloseWhatsAppText(params: BuildDayCloseWhatsAppParams): string {
  const { companyName, dateLabel, data, kindLabel, lang, t } = params;
  const name = (companyName || '').trim();
  const byKind = data.byKind ?? [];
  const salesSummaries = data.salesSummaries ?? [];

  const inflowTotal = asNumber(data.sums?.inflow?.total);
  const outflowTotal = asNumber(data.sums?.outflow?.total);
  const netDay = inflowTotal - outflowTotal;

  const { lines: channelLines, total: channelsSum } = aggregateSalesChannels(salesSummaries, lang);
  const salesTotal =
    salesSummaries.length > 0
      ? channelsSum || salesSummaries.reduce((sum, summary) => sum + asNumber(summary.totalAmount), 0)
      : inflowTotal;
  const customers = salesSummaries.length > 0 ? salesCustomersTotal(salesSummaries) : countByKinds(byKind, 'sale');

  const purchasesTotal = sumByKinds(byKind, PURCHASE_KIND);
  const expensesTotal = sumByKinds(byKind, EXPENSE_KINDS);

  const cashIn = asNumber(data.cash?.dayTotalIn);
  const cashOut = asNumber(data.cash?.dayTotalOut);
  const cashAvailable = asNumber(data.cash?.netDay ?? cashIn - cashOut);

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
    } else if (byKind.some((row) => row.kind === 'sale')) {
      const saleLabel = kindLabel.sale || 'sale';
      lines.push(waMetricLine(t('dayCloseWaFromInvoices'), `${fmt(inflowTotal)} SR (${saleLabel})`));
    }
    if (customers > 0) {
      lines.push(waCustomersLine(t('dayCloseWaCustomersLine'), fmt(customers, 0)));
    }
    lines.push(waAvgSaleMetricLine(t('dayCloseWaAvgInvoiceLine'), salesTotal, customers));
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
    waCashLine(t('dayCloseWaCashIn'), `${fmt(cashIn)} SR`),
    waCashLine(t('dayCloseWaCashOut'), `${fmt(cashOut)} SR`),
    waCashLine(t('dayCloseWaCashAvailable'), `${fmt(cashAvailable)} SR`),
    '',
    t('dayCloseWaFooter'),
  );

  return lines.join('\n').trim();
}

export function openDayCloseWhatsApp(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

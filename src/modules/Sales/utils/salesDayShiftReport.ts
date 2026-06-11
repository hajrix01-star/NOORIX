import { toYmd } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import type { SalesShiftValue } from '../constants/salesShift';
import { parseSalesShiftValue, resolveSalesSummaryShift } from '../constants/salesShift';
import {
  aggregateDayChannelWhatsAppLines,
  aggregateShiftChannelWhatsAppLines,
  type SalesSummaryChannelsLike,
} from './salesWhatsAppChannels';
import type { DailySalesVaultRef } from '../components/DailySalesChannelsChips';
import { computeDayAppShare, computeShiftAppShare, type AppShareResult } from './salesAppShare';
import { appendAppShareWaLines } from './salesWhatsAppAppShare';
import {
  waAvgSaleMetricLine,
  waCustomersLine,
  waMetaLine,
  waMetricLine,
  waReportHeader,
  waShiftSectionTitle,
  waSubheading,
  type SalesWaShiftKind,
} from './salesWhatsAppFormat';

export type SalesSummaryLike = {
  status?: string;
  transactionDate?: string | null;
  shift?: unknown;
  totalAmount?: string | number | null;
  customerCount?: number | null;
  notes?: unknown;
};

export type ShiftDayAggregate = {
  total: number;
  customers: number;
  summaryCount: number;
};

export type DayShiftReport = {
  morning: ShiftDayAggregate;
  evening: ShiftDayAggregate;
  fullDay: ShiftDayAggregate;
  grand: ShiftDayAggregate;
};

const emptyAgg = (): ShiftDayAggregate => ({ total: 0, customers: 0, summaryCount: 0 });

function addToAgg(agg: ShiftDayAggregate, s: SalesSummaryLike) {
  agg.total += Number(s.totalAmount || 0);
  agg.customers += Number(s.customerCount || 0);
  agg.summaryCount += 1;
}

/** تجميع ملخصات يوم واحد (نشطة فقط) حسب الشفت + المجموع الكلي */
export function aggregateSalesDayByShift(
  summaries: SalesSummaryLike[],
  dayYmd: string,
): DayShiftReport {
  const out: DayShiftReport = {
    morning: emptyAgg(),
    evening: emptyAgg(),
    fullDay: emptyAgg(),
    grand: emptyAgg(),
  };
  const day = toYmd(dayYmd);
  if (!day) return out;

  for (const s of summaries) {
    if (s.status === 'cancelled') continue;
    if (toYmd(s.transactionDate) !== day) continue;
    addToAgg(out.grand, s);
    const shift = resolveSalesSummaryShift(s);
    if (shift === 'morning') addToAgg(out.morning, s);
    else if (shift === 'evening') addToAgg(out.evening, s);
    else addToAgg(out.fullDay, s);
  }
  return out;
}

export type EntryShiftRow = {
  shift: SalesShiftValue;
  total: number;
  customers: number;
};

/** تقرير واتساب من شفتات الإدخال المعروفة (لا تعتمد على shift في استجابة API) */
export function buildDayShiftReportFromEntryRows(rows: EntryShiftRow[]): DayShiftReport {
  const out: DayShiftReport = {
    morning: emptyAgg(),
    evening: emptyAgg(),
    fullDay: emptyAgg(),
    grand: emptyAgg(),
  };
  for (const row of rows) {
    const pseudo: SalesSummaryLike = {
      totalAmount: row.total,
      customerCount: row.customers,
      shift: row.shift,
    };
    addToAgg(out.grand, pseudo);
    if (row.shift === 'morning') addToAgg(out.morning, pseudo);
    else if (row.shift === 'evening') addToAgg(out.evening, pseudo);
    else addToAgg(out.fullDay, pseudo);
  }
  return out;
}

export function buildDayShiftReportFromEntryItems(
  summaries: SalesSummaryLike[],
  items: { shift: string }[],
): DayShiftReport {
  const rows: EntryShiftRow[] = items.map((item, i) => ({
    shift: parseSalesShiftValue(item.shift, 'all'),
    total: Number(summaries[i]?.totalAmount ?? 0),
    customers: Number(summaries[i]?.customerCount ?? 0),
  }));
  return buildDayShiftReportFromEntryRows(rows);
}

type BuildDailyWaParams = {
  companyName: string;
  dateLabel: string;
  report: DayShiftReport;
  t: (key: string) => string;
  /** ملخصات اليوم — لعرض قنوات البيع مجمّعة حسب الشفت */
  daySummaries?: SalesSummaryChannelsLike[];
  dayYmd?: string;
  lang?: string;
  vaultById?: Map<string, DailySalesVaultRef>;
  /** نسبة التطبيقات لكل الأيام المسجلة في الشهر */
  monthAppShare?: AppShareResult;
};

function shiftBlock(
  kind: SalesWaShiftKind,
  shiftLabel: string,
  agg: ShiftDayAggregate,
  t: (key: string) => string,
  channelLines: string[],
  appShare?: AppShareResult,
): string[] {
  const title = waShiftSectionTitle(kind, shiftLabel);
  if (agg.summaryCount === 0) {
    return [title, `  ${t('salesDailyWaNoShiftData')}`, ''];
  }
  const lines = [title];
  if (channelLines.length > 0) {
    lines.push(waSubheading(t('salesWhatsAppChannelsHeader')));
    lines.push(...channelLines);
  }
  lines.push(
    waMetricLine(t('salesWhatsAppTotalLine'), `${fmt(agg.total)} SR`),
    waCustomersLine(t('salesWhatsAppCustomersLine'), fmt(agg.customers, 0)),
    waAvgSaleMetricLine(t('salesWhatsAppAvgInvoiceLine'), agg.total, agg.customers),
  );
  if (appShare) {
    appendAppShareWaLines(lines, appShare, t('salesWhatsAppAppShareLine'));
  }
  lines.push('');
  return lines;
}

/** نص واتساب لتقرير يومي شامل (صباحي + مسائي + يوم كامل + المجموع) */
export function buildDailyShiftWhatsAppText(p: BuildDailyWaParams): string {
  const { companyName, dateLabel, report, t, daySummaries, dayYmd, lang, vaultById, monthAppShare } = p;
  const name = (companyName || '').trim();
  const day = dayYmd ? toYmd(dayYmd) : null;
  const canChannels = !!(day && daySummaries?.length && lang);

  const morningChannels = canChannels
    ? aggregateShiftChannelWhatsAppLines(daySummaries!, day, 'morning', lang!, vaultById)
    : [];
  const eveningChannels = canChannels
    ? aggregateShiftChannelWhatsAppLines(daySummaries!, day, 'evening', lang!, vaultById)
    : [];
  const fullDayChannels = canChannels
    ? aggregateShiftChannelWhatsAppLines(daySummaries!, day, 'all', lang!, vaultById)
    : [];

  const morningShare = canChannels
    ? computeShiftAppShare(daySummaries!, day, 'morning', vaultById)
    : undefined;
  const eveningShare = canChannels
    ? computeShiftAppShare(daySummaries!, day, 'evening', vaultById)
    : undefined;
  const fullDayShare = canChannels
    ? computeShiftAppShare(daySummaries!, day, 'all', vaultById)
    : undefined;
  const grandShare = canChannels
    ? computeDayAppShare(daySummaries!, day, vaultById)
    : undefined;

  const lines: string[] = [
    waReportHeader(t('salesDailyWaTitle'), name),
    waMetaLine(t('salesWhatsAppDateLine'), dateLabel),
    '',
    ...shiftBlock('morning', t('salesShiftMorning'), report.morning, t, morningChannels, morningShare),
    ...shiftBlock('evening', t('salesShiftEvening'), report.evening, t, eveningChannels, eveningShare),
  ];

  if (report.fullDay.summaryCount > 0) {
    lines.push(...shiftBlock('fullDay', t('salesShiftFullDay'), report.fullDay, t, fullDayChannels, fullDayShare));
  }

  const grandChannelLines = canChannels
    ? aggregateDayChannelWhatsAppLines(daySummaries!, day, lang!, vaultById)
    : [];

  lines.push(waShiftSectionTitle('grand', t('salesDailyWaGrandTotal')));
  if (grandChannelLines.length > 0) {
    lines.push(waSubheading(t('salesWhatsAppChannelsHeader')));
    lines.push(...grandChannelLines);
  }
  lines.push(
    waMetricLine(t('salesWhatsAppTotalLine'), `${fmt(report.grand.total)} SR`),
    waCustomersLine(t('salesWhatsAppCustomersLine'), fmt(report.grand.customers, 0)),
    waAvgSaleMetricLine(t('salesWhatsAppAvgInvoiceLine'), report.grand.total, report.grand.customers),
  );
  if (grandShare) {
    appendAppShareWaLines(lines, grandShare, t('salesWhatsAppAppShareLine'));
  }
  if (monthAppShare) {
    appendAppShareWaLines(lines, monthAppShare, t('salesWhatsAppAppShareMonthLine'));
  }
  return lines.join('\n').trim();
}

export function openWhatsAppWithText(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

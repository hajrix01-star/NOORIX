import { toYmd } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import type { SalesShiftValue } from '../constants/salesShift';
import { parseSalesShiftValue, resolveSalesSummaryShift } from '../constants/salesShift';
import {
  aggregateDayChannelWhatsAppSummary,
  type SalesSummaryChannelsLike,
} from './salesWhatsAppChannels';
import type { DailySalesVaultRef } from '../components/DailySalesChannelsChips';
import { computeDayAppShare, type AppShareResult } from './salesAppShare';

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

function avgCustomerText(agg: ShiftDayAggregate): string {
  return fmt(agg.customers > 0 ? agg.total / agg.customers : 0);
}

function shiftSummaryLine(label: string, agg: ShiftDayAggregate): string | null {
  if (agg.summaryCount === 0) return null;
  return `${label} ${fmt(agg.total)} | ${fmt(agg.customers, 0)} عميل | متوسط ${avgCustomerText(agg)}`;
}

function appShareSummaryLine(dayShare?: AppShareResult, monthShare?: AppShareResult): string | null {
  const parts: string[] = [];
  if (dayShare && dayShare.totalAmount > 0) parts.push(`اليوم ${fmt(dayShare.appPercent, 1)}%`);
  if (monthShare && monthShare.totalAmount > 0) parts.push(`الشهر ${fmt(monthShare.appPercent, 1)}%`);
  return parts.length > 0 ? `التطبيقات: ${parts.join(' | ')}` : null;
}

/** نص واتساب لتقرير يومي شامل (صباحي + مسائي + يوم كامل + المجموع) */
export function buildDailyShiftWhatsAppText(p: BuildDailyWaParams): string {
  const { companyName, dateLabel, report, daySummaries, dayYmd, lang, vaultById, monthAppShare } = p;
  const name = (companyName || '').trim();
  const day = dayYmd ? toYmd(dayYmd) : null;
  const canChannels = !!(day && daySummaries?.length && lang);

  const grandShare = canChannels
    ? computeDayAppShare(daySummaries!, day, vaultById)
    : undefined;
  const collectionLine = canChannels
    ? aggregateDayChannelWhatsAppSummary(daySummaries!, day, lang!, vaultById)
    : '';

  const shiftLines = [
    shiftSummaryLine('الصباحي', report.morning),
    shiftSummaryLine('المسائي', report.evening),
    shiftSummaryLine('يوم كامل', report.fullDay),
  ].filter((line): line is string => Boolean(line));

  const lines: string[] = ['ملخص مبيعات اليوم'];
  if (name) lines.push(name);
  lines.push(dateLabel, '');
  lines.push(...shiftLines);
  lines.push(
    '',
    `الإجمالي ${fmt(report.grand.total)}`,
    `العملاء ${fmt(report.grand.customers, 0)}`,
    `متوسط العميل ${avgCustomerText(report.grand)}`,
  );
  if (collectionLine) {
    lines.push('', `التحصيل: ${collectionLine}`);
  }
  const appLine = appShareSummaryLine(grandShare, monthAppShare);
  if (appLine) lines.push(appLine);

  return lines.join('\n').trim();
}

export function openWhatsAppWithText(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

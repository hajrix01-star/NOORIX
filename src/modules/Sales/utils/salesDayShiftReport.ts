import { toYmd } from '../../../utils/saudiDate';
import { fmt } from '../../../utils/format';
import type { SalesShiftValue } from '../constants/salesShift';
import { parseSalesShiftValue, resolveSalesSummaryShift } from '../constants/salesShift';

export type SalesSummaryLike = {
  status?: string;
  transactionDate?: string | null;
  shift?: unknown;
  totalAmount?: string | number | null;
  customerCount?: number | null;
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
};

function shiftBlock(
  title: string,
  agg: ShiftDayAggregate,
  t: (key: string) => string,
): string[] {
  if (agg.summaryCount === 0) {
    return [title, t('salesDailyWaNoShiftData'), ''];
  }
  return [
    title,
    `${t('salesWhatsAppTotalLine')} ${fmt(agg.total)} SR`,
    `${t('salesWhatsAppCustomersLine')} ${fmt(agg.customers, 0)}`,
    '',
  ];
}

/** نص واتساب لتقرير يومي شامل (صباحي + مسائي + يوم كامل + المجموع) */
export function buildDailyShiftWhatsAppText(p: BuildDailyWaParams): string {
  const { companyName, dateLabel, report, t } = p;
  const name = (companyName || '').trim();
  const lines: string[] = [
    `${t('salesDailyWaTitle')}${name ? ` — ${name}` : ''}`,
    `${t('salesWhatsAppDateLine')} ${dateLabel}`,
    '',
    ...shiftBlock(`🌅 ${t('salesShiftMorning')}`, report.morning, t),
    ...shiftBlock(`🌙 ${t('salesShiftEvening')}`, report.evening, t),
  ];

  if (report.fullDay.summaryCount > 0) {
    lines.push(...shiftBlock(`☀️ ${t('salesShiftFullDay')}`, report.fullDay, t));
  }

  lines.push(
    `📌 ${t('salesDailyWaGrandTotal')}`,
    `${t('salesWhatsAppTotalLine')} ${fmt(report.grand.total)} SR`,
    `${t('salesWhatsAppCustomersLine')} ${fmt(report.grand.customers, 0)}`,
  );
  return lines.join('\n').trim();
}

export function openWhatsAppWithText(text: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

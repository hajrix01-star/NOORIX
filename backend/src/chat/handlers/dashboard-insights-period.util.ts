import type { DashboardSummaryDateRange } from '../../reporting/reporting.facade';
import type { ChatHandlerContext } from './types';
const MONTH_NAMES_AR = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** عرض شهر/سنة للفترة المختارة — للنسخ فقط، بدون حسابات. */
export function formatInsightsPeriodLabelAr(year: number, selectedMonth: number): string {
  const idx = Math.min(Math.max(selectedMonth, 1), 12) - 1;
  return `الفترة: ${MONTH_NAMES_AR[idx]} ${year}`;
}

export function formatInsightsPeriodLabelEn(year: number, selectedMonth: number): string {
  const idx = Math.min(Math.max(selectedMonth, 1), 12) - 1;
  return `Period: ${MONTH_NAMES_EN[idx]} ${year}`;
}

const MSG_NO_REPORTS_AR =
  'لعرض مؤشرات الحالة المالية يلزم صلاحية عرض التقارير. تواصل مع المسؤول.';
const MSG_NO_REPORTS_EN =
  'You need permission to view reports to see financial insights. Contact your administrator.';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** أسماء أشهر صريحة في سؤال الرؤى — بدون تعديل parsePeriod العام. */
const DASHBOARD_INSIGHTS_MONTH_ROWS: Array<{
  month: number;
  arKeys: string[];
  enPatterns: string[];
}> = [
  { month: 1, arKeys: ['يناير'], enPatterns: ['january', 'jan'] },
  { month: 2, arKeys: ['فبراير'], enPatterns: ['february', 'feb'] },
  { month: 3, arKeys: ['مارس'], enPatterns: ['march', 'mar'] },
  { month: 4, arKeys: ['أبريل', 'ابريل'], enPatterns: ['april', 'apr'] },
  { month: 5, arKeys: ['مايو'], enPatterns: ['may'] },
  { month: 6, arKeys: ['يونيو'], enPatterns: ['june', 'jun'] },
  { month: 7, arKeys: ['يوليو'], enPatterns: ['july', 'jul'] },
  { month: 8, arKeys: ['أغسطس', 'اغسطس'], enPatterns: ['august', 'aug'] },
  { month: 9, arKeys: ['سبتمبر'], enPatterns: ['september', 'sep'] },
  { month: 10, arKeys: ['أكتوبر', 'اكتوبر'], enPatterns: ['october', 'oct'] },
  { month: 11, arKeys: ['نوفمبر'], enPatterns: ['november', 'nov'] },
  { month: 12, arKeys: ['ديسمبر'], enPatterns: ['december', 'dec'] },
];

function extractCalendarYearFromQuery(q: string, now: Date): number {
  const m = q.match(/\b(19\d{2}|20\d{2})\b/);
  if (m) return parseInt(m[1], 10);
  return now.getFullYear();
}

/**
 * يستخرج شهراً تقويمياً صريحاً من نص السؤال (عربي/إنجليزي).
 * لا يغيّر أي حسابات مالية — تواريخ عرض فقط.
 */
export function parseDashboardInsightsMonth(
  q: string,
  now: Date,
): { year: number; selectedMonth: number } | null {
  const year = extractCalendarYearFromQuery(q, now);

  const arFlat = DASHBOARD_INSIGHTS_MONTH_ROWS.flatMap((row) =>
    row.arKeys.map((key) => ({ month: row.month, key })),
  ).sort((a, b) => b.key.length - a.key.length);

  for (const { month, key } of arFlat) {
    if (q.includes(key)) {
      return { year, selectedMonth: month };
    }
  }

  const lower = q.toLowerCase();
  for (const row of DASHBOARD_INSIGHTS_MONTH_ROWS) {
    const sorted = [...row.enPatterns].sort((a, b) => b.length - a.length);
    for (const pat of sorted) {
      try {
        const re = new RegExp(`\\b${pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(lower)) {
          return { year, selectedMonth: row.month };
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

/** يطابق بناء فترة لوحة التحكم لشهر تقويمي واحد (بدون حسابات مالية جديدة). */
export function buildDashboardInsightsDateRangeForMonth(
  year: number,
  selectedMonth: number,
): DashboardSummaryDateRange {
  const last = new Date(year, selectedMonth, 0).getDate();
  const monthStart = `${year}-${pad2(selectedMonth)}-01`;
  const monthEnd = `${year}-${pad2(selectedMonth)}-${pad2(last)}`;
  return {
    year,
    yearStart: `${year}-01-01`,
    yearEnd: `${year}-12-31`,
    dailyStart: null,
    dailyEnd: null,
    monthStart,
    monthEnd,
    periodStart: monthStart,
    periodEnd: monthEnd,
  };
}

/**
 * شهر/سنة الرؤى: أولاً شهر صريح بالاسم، ثم parsePeriod، ثم الشهر الحالي.
 */
export function resolveInsightsYearMonth(ctx: ChatHandlerContext): {
  year: number;
  selectedMonth: number;
} {
  const explicit = parseDashboardInsightsMonth(ctx.query, ctx.now);
  if (explicit) return explicit;
  if (ctx.period) {
    const start = ctx.period.start;
    return { year: start.getFullYear(), selectedMonth: start.getMonth() + 1 };
  }
  return { year: ctx.now.getFullYear(), selectedMonth: ctx.now.getMonth() + 1 };
}



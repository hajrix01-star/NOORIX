/**
 * ردود حتمية من رؤى لوحة التحكم — مصدر البيانات {@link ReportingInsightsAggregatorService.getExtendedInsights}
 * (يضم {@link DashboardInsightsService} وخدمات المشتريات/المصاريف دون تغيير حساباتها).
 */
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { DashboardSummaryDateRange } from '../../reporting/reporting.facade';
import type { DashboardInsightsPayload, InsightItem } from '../../reporting/insights/insights.types';
import { formatInsightPercentFraction } from '../../reporting/insights/insights.rules';
import { INSIGHT_THRESHOLDS } from '../../reporting/insights/insights.thresholds';
import type { PurchaseCategoryBreakdownRow } from '../../reporting/insights/purchases/purchase-supplier-insights.rules';
import type {
  CombinedInsightWarning,
  ExtendedReportingInsightsPayload,
} from '../../reporting/insights/reporting-insights-aggregator.types';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';

const PURCHASE_INSIGHT_IDS = new Set(['purchase_ratio_to_sales', 'unusually_high_purchases_warning']);
const PROFIT_INSIGHT_IDS = new Set(['net_profit_margin', 'negative_profit_warning']);
const EXPENSE_INSIGHT_IDS = new Set(['expense_ratio_to_sales']);

/** نصوص تُعرض عند عدم وجود تنبيهات مطابِقة — دون استخدام ملخص «الصحة» من الخادم (قد يحتوي صياغة تقنية). */
const MSG_NO_ALERT_AR = `لا توجد تنبيهات مالية حالياً.
الأرقام الحالية لا تتجاوز حدود التحذير المحددة لهذه الشركة.`;

const MSG_NO_ALERT_EN = `No financial alerts right now.
Current figures do not exceed this company's configured warning thresholds.`;

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

export type DashboardInsightsQueryKind = 'general' | 'purchases' | 'profit' | null;

/** مجال تركيز السؤال — نفس النية dashboard_insights، عرض فقط. */
export type DashboardInsightsFocus =
  | 'overview'
  | 'purchases'
  | 'expenses'
  | 'profitability'
  | 'alerts';

/**
 * يحدد تركيز السؤال من الصياغة (عربي/إنجليزي) — ترتيب الأولوية: تنبيهات ← مصاريف ← مشتريات ← ربحية.
 * لا يستبدل النية ولا يستدعي خدمات.
 */
export function resolveDashboardInsightsFocus(q: string): DashboardInsightsFocus {
  const lower = q.toLowerCase();
  if (
    matches(q, [
      'حلل الوضع المالي',
      'كيف الوضع المالي',
      'تقرير مالي مختصر',
      'ملخص مالي',
    ]) ||
    /\bfinancial overview\b/i.test(lower) ||
    /\bfinancial health\b/i.test(lower) ||
    /\bbusiness health\b/i.test(lower)
  ) {
    return 'overview';
  }
  if (
    matches(q, [
      'وش أهم التنبيهات',
      'وش اهم التنبيهات',
      'وش التنبيهات',
      'اهم التنبيهات',
      'أهم التنبيهات',
      'تنبيهات مهمة',
      'التنبيهات المالية',
      'financial alerts',
      'main alerts',
    ]) ||
    /\balerts\b/i.test(lower) ||
    /\bwarnings\b/i.test(lower)
  ) {
    return 'alerts';
  }
  if (
    matches(q, [
      'حلل المصاريف',
      'تحليل المصاريف',
      'تحليل مصاريف',
      'expense analysis',
      'analyze expenses',
      'هل المصاريف مرتفعة',
      'مصاريف مرتفعة',
    ])
  ) {
    return 'expenses';
  }
  if (
    matches(q, [
      'حلل المشتريات',
      'تحليل المشتريات',
      'تحليل مشتريات',
      'purchase analysis',
      'analyze purchases',
      'هل المشتريات مرتفعة',
      'مشتريات مرتفعة',
      'are purchases high',
      'purchases high',
    ])
  ) {
    return 'purchases';
  }
  if (
    matches(q, [
      'هل الربحية',
      'ربحية سيئة',
      'عائد ربحي',
      'profit margin',
      'net profit',
      'profitability',
      'هل الربح جيد',
      'الربح جيد',
      'is profit good',
      'profit good',
      'هامش الربح',
      'هامش ربح',
    ])
  ) {
    return 'profitability';
  }
  return 'overview';
}

/** يدمج تركيز الكلمات مع تصنيف السؤال القديم (مشتريات/ربح). */
export function resolveEffectiveDashboardInsightsFocus(
  q: string,
  kind: DashboardInsightsQueryKind,
): DashboardInsightsFocus {
  const fromPhrase = resolveDashboardInsightsFocus(q);
  if (fromPhrase !== 'overview') return fromPhrase;
  if (kind === 'purchases') return 'purchases';
  if (kind === 'profit') return 'profitability';
  return 'overview';
}

function focusToDashKind(focus: DashboardInsightsFocus): DashboardInsightsQueryKind {
  if (focus === 'purchases') return 'purchases';
  if (focus === 'profitability') return 'profit';
  return 'general';
}

export function classifyDashboardInsightsQuery(q: string): DashboardInsightsQueryKind {
  if (
    matches(q, [
      'هل المشتريات مرتفعة',
      'مشتريات مرتفعة',
      'are purchases high',
      'purchases high',
    ])
  ) {
    return 'purchases';
  }
  if (matches(q, ['هل الربح جيد', 'الربح جيد', 'is profit good', 'profit good'])) {
    return 'profit';
  }
  if (
    matches(q, [
      'كيف وضع الشهر',
      'وضع الشهر',
      'ملخص الشهر',
      'اعطني ملخص الشهر',
      'how is the month',
      'monthly summary',
      'month status',
    ]) ||
    (matches(q, ['ملخص']) && matches(q, ['شهر']))
  ) {
    return 'general';
  }

  if (
    matches(q, [
      'حلل الوضع المالي',
      'كيف الوضع المالي',
      'تقرير مالي مختصر',
      'ملخص مالي',
    ])
  ) {
    return 'general';
  }

  const lower = q.toLowerCase();
  if (
    /\bfinancial overview\b/i.test(lower) ||
    /\bfinancial health\b/i.test(lower) ||
    /\bbusiness health\b/i.test(lower)
  ) {
    return 'general';
  }
  if (
    matches(q, [
      'حلل المشتريات',
      'تحليل المشتريات',
      'purchase analysis',
      'analyze purchases',
      'حلل المصاريف',
      'تحليل المصاريف',
      'expense analysis',
      'analyze expenses',
      'هل الربحية',
      'ربحية سيئة',
      'profit margin',
      'net profit',
      'profitability',
      'وش أهم التنبيهات',
      'وش اهم التنبيهات',
      'اهم التنبيهات',
      'أهم التنبيهات',
      'تنبيهات مهمة',
    ]) ||
    /\balerts\b/i.test(lower) ||
    /\bwarnings\b/i.test(lower)
  ) {
    return 'general';
  }

  const explicitMonth = parseDashboardInsightsMonth(q, new Date());
  if (explicitMonth !== null) {
    if (
      matches(q, [
        'كيف وضع',
        'وضع الشهر',
        'ملخص الشهر',
        'اعطني ملخص الشهر',
        'how is',
        "how's",
        'monthly summary',
        'month status',
      ]) ||
      (matches(q, ['ملخص']) && matches(q, ['شهر']))
    ) {
      return 'general';
    }
  }

  return null;
}

function filterWarnings(kind: DashboardInsightsQueryKind, warnings: InsightItem[]): InsightItem[] {
  if (kind === 'purchases') {
    return warnings.filter((w) => PURCHASE_INSIGHT_IDS.has(w.id));
  }
  if (kind === 'profit') {
    return warnings.filter((w) => PROFIT_INSIGHT_IDS.has(w.id));
  }
  return warnings;
}

function filterMergedByFocus(focus: DashboardInsightsFocus, merged: CombinedInsightWarning[]): CombinedInsightWarning[] {
  if (focus === 'overview') return merged;
  if (focus === 'purchases') {
    return merged.filter((w) => w.source === 'purchases' || PURCHASE_INSIGHT_IDS.has(w.id));
  }
  if (focus === 'expenses') {
    return merged.filter(
      (w) => w.source === 'expenses' || EXPENSE_INSIGHT_IDS.has(w.id) || w.category === 'expenses',
    );
  }
  if (focus === 'profitability') {
    return merged.filter((w) => PROFIT_INSIGHT_IDS.has(w.id) || w.category === 'profit');
  }
  if (focus === 'alerts') {
    const serious = merged.filter((w) => w.severity === 'critical' || w.severity === 'warning');
    return serious.length > 0 ? serious : merged;
  }
  return merged;
}

function msgNoFocusAreaAr(focus: DashboardInsightsFocus): string {
  switch (focus) {
    case 'purchases':
      return 'لا توجد تنبيهات محددة في مجال المشتريات ضمن الفترة المعروضة.';
    case 'expenses':
      return 'لا توجد تنبيهات محددة في مجال المصروفات ضمن الفترة المعروضة.';
    case 'profitability':
      return 'لا توجد تنبيهات محددة في مجال الربحية ضمن الفترة المعروضة.';
    case 'alerts':
      return 'لا توجد تنبيهات متابعة بارزة ضمن الفترة المعروضة.';
    default:
      return MSG_NO_ALERT_AR;
  }
}

function msgNoFocusAreaEn(focus: DashboardInsightsFocus): string {
  switch (focus) {
    case 'purchases':
      return 'No purchase-specific alerts for the selected period.';
    case 'expenses':
      return 'No expense-specific alerts for the selected period.';
    case 'profitability':
      return 'No profitability-specific alerts for the selected period.';
    case 'alerts':
      return 'No notable alerts to follow up on for the selected period.';
    default:
      return MSG_NO_ALERT_EN;
  }
}

function sourcePrefixAr(w: InsightItem & { source?: string }): string {
  if (w.source === 'purchases') return '[مشتريات] ';
  if (w.source === 'expenses') return '[مصاريف] ';
  if (w.source === 'dashboard') return '[لوحة] ';
  return '';
}

function sourcePrefixEn(w: InsightItem & { source?: string }): string {
  if (w.source === 'purchases') return '[Purchases] ';
  if (w.source === 'expenses') return '[Expenses] ';
  if (w.source === 'dashboard') return '[Dashboard] ';
  return '';
}

function formatLinesAr(items: Array<InsightItem & { source?: string }>): string {
  return items
    .map((w) => {
      const p = sourcePrefixAr(w);
      const d = w.detailAr?.trim();
      return d ? `• ${p}${w.titleAr}\n  ${d}` : `• ${p}${w.titleAr}`;
    })
    .join('\n');
}

function formatLinesEn(items: Array<InsightItem & { source?: string }>): string {
  return items
    .map((w) => {
      const p = sourcePrefixEn(w);
      const d = w.detailEn?.trim();
      return d ? `• ${p}${w.titleEn}\n  ${d}` : `• ${p}${w.titleEn}`;
    })
    .join('\n');
}

function countBySeverity(merged: CombinedInsightWarning[]): { critical: number; warning: number; info: number } {
  const o = { critical: 0, warning: 0, info: 0 };
  for (const w of merged) {
    if (w.severity === 'critical') o.critical += 1;
    else if (w.severity === 'warning') o.warning += 1;
    else o.info += 1;
  }
  return o;
}

function formatSourcesAr(merged: CombinedInsightWarning[]): string {
  const s = new Set(merged.map((w) => w.source));
  const parts: string[] = [];
  if (s.has('dashboard')) parts.push('لوحة');
  if (s.has('purchases')) parts.push('مشتريات');
  if (s.has('expenses')) parts.push('مصاريف');
  return parts.join('، ');
}

function formatSourcesEn(merged: CombinedInsightWarning[]): string {
  const s = new Set(merged.map((w) => w.source));
  const parts: string[] = [];
  if (s.has('dashboard')) parts.push('dashboard');
  if (s.has('purchases')) parts.push('purchases');
  if (s.has('expenses')) parts.push('expenses');
  return parts.join(', ');
}

/** ملخص مضغوط بعد النقاط — بدون JSON خام. */
function formatCompactSummaryAr(merged: CombinedInsightWarning[]): string | null {
  if (merged.length === 0) return null;
  const c = countBySeverity(merged);
  const parts: string[] = [];
  if (c.critical) parts.push(`${c.critical} حرج`);
  if (c.warning) parts.push(`${c.warning} تحذير`);
  if (c.info) parts.push(`${c.info} معلومات`);
  const critTitles = merged.filter((w) => w.severity === 'critical').slice(0, 2).map((w) => w.titleAr);
  const topLine =
    critTitles.length > 0 ? `أبرز التنبيهات: ${critTitles.join('؛ ')}.` : '';
  return [
    `ملخص التنبيهات: ${merged.length} إجمالي (${parts.join('، ')}). المصادر: ${formatSourcesAr(merged)}.`,
    topLine,
  ]
    .filter(Boolean)
    .join(' ');
}

function formatCompactSummaryEn(merged: CombinedInsightWarning[]): string | null {
  if (merged.length === 0) return null;
  const c = countBySeverity(merged);
  const parts: string[] = [];
  if (c.critical) parts.push(`${c.critical} critical`);
  if (c.warning) parts.push(`${c.warning} warning(s)`);
  if (c.info) parts.push(`${c.info} info`);
  const critTitles = merged.filter((w) => w.severity === 'critical').slice(0, 2).map((w) => w.titleEn);
  const topLine =
    critTitles.length > 0 ? `Top alerts: ${critTitles.join('; ')}.` : '';
  return [
    `Alert overview: ${merged.length} total (${parts.join(', ')}). Sources: ${formatSourcesEn(merged)}.`,
    topLine,
  ]
    .filter(Boolean)
    .join(' ');
}

function accountingCellPresent(v: string | number | null | undefined): boolean {
  if (v === null || v === undefined) return false;
  return String(v).trim() !== '';
}

function parseInvoiceAmountStr(s: string): number {
  const n = parseFloat(String(s ?? '0').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function purchaseRowStatusAr(row: PurchaseCategoryBreakdownRow, merged: CombinedInsightWarning[]): string {
  for (const w of merged) {
    const v = w.values as Record<string, unknown> | undefined;
    if (!v) continue;
    if (w.id === 'purchase_category_concentration_warning' && String(v.topCategoryId ?? '') === String(row.categoryId ?? '')) {
      return w.severity === 'critical' ? 'حرج' : 'تحذير';
    }
    if (w.id === 'purchase_uncategorized_share_warning' && row.categoryId == null) {
      return w.severity === 'critical' ? 'حرج' : 'تحذير';
    }
    if (w.id === 'purchase_category_spike_warning' && String(v.categoryId ?? '') === String(row.categoryId ?? '')) {
      return w.severity === 'critical' ? 'حرج' : 'تحذير';
    }
  }
  return '—';
}

function purchaseRowStatusEn(row: PurchaseCategoryBreakdownRow, merged: CombinedInsightWarning[]): string {
  for (const w of merged) {
    const v = w.values as Record<string, unknown> | undefined;
    if (!v) continue;
    if (w.id === 'purchase_category_concentration_warning' && String(v.topCategoryId ?? '') === String(row.categoryId ?? '')) {
      return w.severity === 'critical' ? 'Critical' : 'Warning';
    }
    if (w.id === 'purchase_uncategorized_share_warning' && row.categoryId == null) {
      return w.severity === 'critical' ? 'Critical' : 'Warning';
    }
    if (w.id === 'purchase_category_spike_warning' && String(v.categoryId ?? '') === String(row.categoryId ?? '')) {
      return w.severity === 'critical' ? 'Critical' : 'Warning';
    }
  }
  return '—';
}

function expenseRowStatusAr(rowKey: string, merged: CombinedInsightWarning[]): string {
  const catId = rowKey.startsWith('category:') ? rowKey.slice('category:'.length) : null;
  for (const w of merged) {
    const v = w.values as Record<string, unknown> | undefined;
    if (!v) continue;
    if (w.id === 'top_expense_category_share_warning' && catId && String(v.categoryId ?? '') === catId) {
      return w.severity === 'critical' ? 'حرج' : 'تحذير';
    }
    if (w.id === 'missing_expense_category_warning' && rowKey === 'uncategorized:expense') {
      return w.severity === 'critical' ? 'حرج' : 'تحذير';
    }
  }
  return '—';
}

function expenseRowStatusEn(rowKey: string, merged: CombinedInsightWarning[]): string {
  const catId = rowKey.startsWith('category:') ? rowKey.slice('category:'.length) : null;
  for (const w of merged) {
    const v = w.values as Record<string, unknown> | undefined;
    if (!v) continue;
    if (w.id === 'top_expense_category_share_warning' && catId && String(v.categoryId ?? '') === catId) {
      return w.severity === 'critical' ? 'Critical' : 'Warning';
    }
    if (w.id === 'missing_expense_category_warning' && rowKey === 'uncategorized:expense') {
      return w.severity === 'critical' ? 'Critical' : 'Warning';
    }
  }
  return '—';
}

function overviewRecommendationsAr(band: DashboardInsightsPayload['health']['band']): string[] {
  const out: string[] = [];
  if (band === 'red') {
    out.push('أولوية لهذا الشهر: معالجة أسباب التنبيهات الحرجة قبل زيادة الالتزامات أو الاستثمار.');
  } else if (band === 'amber') {
    out.push('راجع بنود التحذير أعلاه وتحقق من اكتمال التصنيف في المشتريات والمصاريف.');
  } else if (band === 'green') {
    out.push('تابع القراءة الشهرية لنفس المؤشرات للإبقاء على المسار الحالي.');
  }
  if (out.length < 2) {
    out.push('استخدم تقارير التفصيل في النظام عند الحاجة لمقارنة هذا الشهر بأشهر سابقة.');
  }
  return out.slice(0, 2);
}

function overviewRecommendationsEn(band: DashboardInsightsPayload['health']['band']): string[] {
  const out: string[] = [];
  if (band === 'red') {
    out.push('Priority this month: address critical alert drivers before increasing commitments or investment.');
  } else if (band === 'amber') {
    out.push('Review the warning items above and confirm purchase/expense categorization is complete.');
  } else if (band === 'green') {
    out.push('Keep the same monthly indicators review cadence to catch changes early.');
  }
  if (out.length < 2) {
    out.push('Use detailed reports in the system when you need to compare this month to prior months.');
  }
  return out.slice(0, 2);
}

function buildMoneyOverviewAnswer(
  extended: ExtendedReportingInsightsPayload,
  merged: CombinedInsightWarning[],
  year: number,
  selectedMonth: number,
): { answerAr: string; answerEn: string } {
  const payload = extended.dashboardInsights;
  const periodAr = formatInsightsPeriodLabelAr(year, selectedMonth);
  const periodEn = formatInsightsPeriodLabelEn(year, selectedMonth);
  const m = payload.metrics.accounting;
  const r = payload.ratios;
  const eps = INSIGHT_THRESHOLDS.salesEpsilon;

  const snapAr: string[] = [];
  const snapEn: string[] = [];
  if (accountingCellPresent(m.sales)) {
    snapAr.push(`المبيعات\t${String(m.sales).trim()}`);
    snapEn.push(`Sales\t${String(m.sales).trim()}`);
  }
  if (accountingCellPresent(m.purchases)) {
    snapAr.push(`المشتريات\t${String(m.purchases).trim()}`);
    snapEn.push(`Purchases\t${String(m.purchases).trim()}`);
  }
  if (accountingCellPresent(m.expenses)) {
    snapAr.push(`المصاريف\t${String(m.expenses).trim()}`);
    snapEn.push(`Expenses\t${String(m.expenses).trim()}`);
  }
  if (accountingCellPresent(m.netProfit)) {
    snapAr.push(`صافي الربح\t${String(m.netProfit).trim()}`);
    snapEn.push(`Net profit\t${String(m.netProfit).trim()}`);
  }
  if (r.purchaseToSales != null && Number.isFinite(r.purchaseToSales)) {
    snapAr.push(`مشتريات/مبيعات\t${formatInsightPercentFraction(r.purchaseToSales)}%`);
    snapEn.push(`Purchases / sales\t${formatInsightPercentFraction(r.purchaseToSales)}%`);
  }
  if (r.expenseToSales != null && Number.isFinite(r.expenseToSales)) {
    snapAr.push(`مصاريف/مبيعات\t${formatInsightPercentFraction(r.expenseToSales)}%`);
    snapEn.push(`Expenses / sales\t${formatInsightPercentFraction(r.expenseToSales)}%`);
  }
  if (r.netProfitMargin != null && Number.isFinite(r.netProfitMargin)) {
    snapAr.push(`هامش صافي الربح\t${formatInsightPercentFraction(r.netProfitMargin)}%`);
    snapEn.push(`Net margin\t${formatInsightPercentFraction(r.netProfitMargin)}%`);
  }

  const purchaseRows = extended.purchaseSupplierInsights.periodPurchaseCategoryBreakdown?.slice(0, 5);
  const purchaseTotalStr = extended.purchaseSupplierInsights.periodPurchaseCategoryTotal;
  const purchaseTotal = purchaseTotalStr != null ? parseInvoiceAmountStr(purchaseTotalStr) : 0;

  const purchaseAr: string[] = [];
  const purchaseEn: string[] = [];
  if (purchaseRows?.length && purchaseTotal > eps) {
    for (const row of purchaseRows) {
      const amt = parseInvoiceAmountStr(row.amount);
      const share = amt / purchaseTotal;
      const pct = formatInsightPercentFraction(share);
      const stAr = purchaseRowStatusAr(row, merged);
      const stEn = purchaseRowStatusEn(row, merged);
      const label = row.nameAr?.trim() || row.nameEn || '—';
      const labelEn = row.nameEn?.trim() || row.nameAr || '—';
      purchaseAr.push(`${label}\t${row.amount}\t${pct}%\t${stAr}`);
      purchaseEn.push(`${labelEn}\t${row.amount}\t${pct}%\t${stEn}`);
    }
  }

  const expenseRows = extended.expenseInsights.expenseCategoryBreakdown?.slice(0, 5);
  const expenseAr: string[] = [];
  const expenseEn: string[] = [];
  if (expenseRows?.length) {
    for (const row of expenseRows) {
      const share = row.shareOfGroupTotal;
      const pct = share != null && Number.isFinite(share) ? `${formatInsightPercentFraction(share)}%` : '—';
      expenseAr.push(`${row.labelAr}\t${row.amountDisplay}\t${pct}\t${expenseRowStatusAr(row.key, merged)}`);
      expenseEn.push(`${row.labelEn}\t${row.amountDisplay}\t${pct}\t${expenseRowStatusEn(row.key, merged)}`);
    }
  }

  const salesRows = payload.salesBreakdown?.slice(0, 5);
  const salesAr: string[] = [];
  const salesEn: string[] = [];
  if (salesRows?.length) {
    for (const row of salesRows) {
      const share = row.shareOfGroupTotal;
      const pct = share != null && Number.isFinite(share) ? `${formatInsightPercentFraction(share)}%` : '—';
      salesAr.push(`${row.labelAr}\t${row.amountDisplay}\t${pct}\t—`);
      salesEn.push(`${row.labelEn}\t${row.amountDisplay}\t${pct}\t—`);
    }
  }

  const warnPick = merged.slice(0, 3);
  const warnAr =
    warnPick.length > 0
      ? warnPick
          .map((w) => {
            const p = sourcePrefixAr(w);
            const d = w.detailAr?.trim();
            return d ? `• ${p}${w.titleAr}\n  ${d}` : `• ${p}${w.titleAr}`;
          })
          .join('\n')
      : MSG_NO_ALERT_AR;
  const warnEn =
    warnPick.length > 0
      ? warnPick
          .map((w) => {
            const p = sourcePrefixEn(w);
            const d = w.detailEn?.trim();
            return d ? `• ${p}${w.titleEn}\n  ${d}` : `• ${p}${w.titleEn}`;
          })
          .join('\n')
      : MSG_NO_ALERT_EN;

  const recoAr = overviewRecommendationsAr(payload.health.band)
    .map((line) => `• ${line}`)
    .join('\n');
  const recoEn = overviewRecommendationsEn(payload.health.band)
    .map((line) => `• ${line}`)
    .join('\n');

  const partsAr: string[] = ['تحليل الوضع المالي', '', periodAr, '', payload.health.summaryAr];
  const partsEn: string[] = ['Financial overview', '', periodEn, '', payload.health.summaryEn];

  if (snapAr.length > 0) {
    partsAr.push('', '١) لقطة مالية', 'النوع\tالمبلغ', ...snapAr);
    partsEn.push('', '1) Financial snapshot', 'Item\tAmount', ...snapEn);
  }
  if (purchaseAr.length > 0) {
    partsAr.push('', '٢) مشتريات حسب الفئة (فترة الفواتير)', 'الفئة\tالمبلغ\tمن إجمالي المشتريات\tالحالة', ...purchaseAr);
    partsEn.push(
      '',
      '2) Purchases by category (invoice period)',
      'Category\tAmount\t% of purchases\tStatus',
      ...purchaseEn,
    );
  }
  if (expenseAr.length > 0) {
    partsAr.push('', '٣) مصاريف حسب الفئة (دفتر الشهر)', 'الفئة\tالمبلغ\tمن إجمالي المصاريف\tالحالة', ...expenseAr);
    partsEn.push('', '3) Expenses by category (month ledger)', 'Category\tAmount\t% of expenses\tStatus', ...expenseEn);
  }
  if (salesAr.length > 0) {
    partsAr.push('', '٤) المبيعات حسب المصدر (دفتر الشهر)', 'البند\tالمبلغ\tمن إجمالي المبيعات\tالحالة', ...salesAr);
    partsEn.push('', '4) Sales breakdown (month ledger)', 'Item\tAmount\t% of sales\tStatus', ...salesEn);
  }
  partsAr.push('', '٥) أبرز التنبيهات', warnAr);
  partsEn.push('', '5) Top alerts', warnEn);
  partsAr.push('', '٦) توصيات عملية', recoAr);
  partsEn.push('', '6) Practical recommendations', recoEn);

  return { answerAr: partsAr.join('\n'), answerEn: partsEn.join('\n') };
}

function buildAnswer(
  focus: DashboardInsightsFocus,
  extended: ExtendedReportingInsightsPayload,
  year: number,
  selectedMonth: number,
): { answerAr: string; answerEn: string } {
  const payload = extended.dashboardInsights;
  const healthAr = payload.health.summaryAr;
  const healthEn = payload.health.summaryEn;
  const merged = extended.warnings;

  if (focus === 'overview') {
    return buildMoneyOverviewAnswer(extended, merged, year, selectedMonth);
  }

  const pool = filterMergedByFocus(focus, merged);
  const maxPick = focus === 'alerts' ? 5 : 8;
  const picked = pool.slice(0, maxPick);
  const compactAr = formatCompactSummaryAr(merged);
  const compactEn = formatCompactSummaryEn(merged);
  if (picked.length === 0) {
    const periodAr = formatInsightsPeriodLabelAr(year, selectedMonth);
    const periodEn = formatInsightsPeriodLabelEn(year, selectedMonth);
    const baseAr = [periodAr, '', healthAr, '', msgNoFocusAreaAr(focus)];
    const baseEn = [periodEn, '', healthEn, '', msgNoFocusAreaEn(focus)];
    if (compactAr) baseAr.push('', compactAr);
    if (compactEn) baseEn.push('', compactEn);
    return { answerAr: baseAr.join('\n'), answerEn: baseEn.join('\n') };
  }
  const partsAr = [healthAr, '', formatLinesAr(picked)];
  const partsEn = [healthEn, '', formatLinesEn(picked)];
  if (compactAr) partsAr.push('', compactAr);
  if (compactEn) partsEn.push('', compactEn);
  return { answerAr: partsAr.join('\n'), answerEn: partsEn.join('\n') };
}

/** Exported for unit tests — deterministic Smart Chat body for dashboard_insights. */
export function buildDashboardInsightsDeterministicAnswer(
  focus: DashboardInsightsFocus,
  extended: ExtendedReportingInsightsPayload,
  year: number,
  selectedMonth: number,
): { answerAr: string; answerEn: string } {
  return buildAnswer(focus, extended, year, selectedMonth);
}

/** لاختبارات الوحدة — حزمة JSON آمنة لشرح LLM فقط (لوحة فقط). */
export function buildInsightsExplanationPackage(
  payload: DashboardInsightsPayload,
  kind: DashboardInsightsQueryKind,
  year: number,
  selectedMonth: number,
): Record<string, unknown> {
  const warningsForPack =
    kind === 'general' ? payload.warnings.slice(0, 25) : filterWarnings(kind, payload.warnings);
  const mapItem = (w: InsightItem) => ({
    id: w.id,
    severity: w.severity,
    category: w.category,
    metricBasis: w.metricBasis,
    titleAr: w.titleAr,
    detailAr: w.detailAr,
    titleEn: w.titleEn,
    detailEn: w.detailEn,
    values: w.values,
  });
  return {
    periodLabel: {
      ar: formatInsightsPeriodLabelAr(year, selectedMonth),
      en: formatInsightsPeriodLabelEn(year, selectedMonth),
    },
    health: {
      summaryAr: payload.health.summaryAr,
      summaryEn: payload.health.summaryEn,
      band: payload.health.band,
      score: payload.health.score,
    },
    warnings: warningsForPack.map(mapItem),
    insights: payload.insights.slice(0, 25).map(mapItem),
    ratios: payload.ratios,
    metrics: payload.metrics,
  };
}

function mapMergedForPack(w: CombinedInsightWarning) {
  return {
    id: w.id,
    severity: w.severity,
    category: w.category,
    metricBasis: w.metricBasis,
    titleAr: w.titleAr,
    detailAr: w.detailAr,
    titleEn: w.titleEn,
    detailEn: w.detailEn,
    values: w.values,
    source: w.source,
  };
}

/** حزمة موسّعة لـ LLM — رؤى مدمجة مع الحفاظ على حقول اللوحة الأساسية. */
export function buildExtendedInsightsExplanationPackage(
  extended: ExtendedReportingInsightsPayload,
  focus: DashboardInsightsFocus,
  year: number,
  selectedMonth: number,
): Record<string, unknown> {
  const dash = extended.dashboardInsights;
  const dashKind = focusToDashKind(focus);
  const base = buildInsightsExplanationPackage(dash, dashKind, year, selectedMonth);
  const mergedForPack =
    focus === 'overview'
      ? extended.warnings.slice(0, 25)
      : filterMergedByFocus(focus, extended.warnings).slice(0, 25);
  const c = countBySeverity(extended.warnings);
  return {
    ...base,
    warnings: mergedForPack.map(mapMergedForPack),
    mergedOverview: {
      total: extended.warnings.length,
      critical: c.critical,
      warning: c.warning,
      info: c.info,
      sourcesPresent: [...new Set(extended.warnings.map((w) => w.source))],
      focus,
    },
    purchaseSupplierWarningCount: extended.purchaseSupplierInsights.warnings.length,
    expenseWarningCount: extended.expenseInsights.warnings.length,
  };
}

function queryLooksArabic(q: string): boolean {
  return /[\u0600-\u06FF]/.test(q);
}

/** أرقام مالية كبيرة في نص LLM يجب أن تظهر في JSON الحزمة — يقلل الادعاءات غير المدعومة */
function insightsLlmContainsUngroundedLargeNumber(text: string, packStr: string): boolean {
  const nums = text.match(/\b\d{4,}(?:[.,]\d+)?\b/g);
  if (!nums) return false;
  const flatPack = packStr.replace(/\s+/g, '');
  for (const num of nums) {
    const candidates = [num, num.replace(/,/g, ''), num.replace(/\./g, ',')];
    if (candidates.some((c) => flatPack.includes(c.replace(/\s+/g, '')))) continue;
    return true;
  }
  return false;
}

/** يُرجع true إذا كان نص LLM مقبولاً كبديل عن الرد الحتمي */
export function validateInsightsLlmAnswer(llm: { answerAr: string; answerEn: string }, packStr: string): boolean {
  const ar = String(llm.answerAr || '').trim();
  const en = String(llm.answerEn || '').trim();
  if (ar.length < 8 || en.length < 8) return false;
  const MAX = 1100;
  if (ar.length > MAX || en.length > MAX || ar.length + en.length > 2000) return false;
  if (/{/.test(ar) || /{/.test(en)) return false;
  if (insightsLlmContainsUngroundedLargeNumber(`${ar}\n${en}`, packStr)) return false;
  return true;
}

export const dashboardInsightsHandler: ChatHandler = {
  priority: 5,
  intent: 'dashboard_insights',
  matchesIntent: (intent, can) =>
    intent === 'dashboard_insights' && can(PERMISSIONS.REPORTS_READ) && can(PERMISSIONS.SMART_CHAT_READ),
  canHandle: (q) => classifyDashboardInsightsQuery(q) != null,
  process: async (ctx) => {
    let kind = classifyDashboardInsightsQuery(ctx.query);
    if (kind == null && ctx.intentSource === 'gemini' && ctx.parsedIntent === 'dashboard_insights') {
      kind = 'general';
    }
    if (kind == null) return null;

    if (!ctx.can(PERMISSIONS.REPORTS_READ)) {
      return { answerAr: MSG_NO_REPORTS_AR, answerEn: MSG_NO_REPORTS_EN };
    }

    const { year, selectedMonth } = resolveInsightsYearMonth(ctx);
    const dateRange = buildDashboardInsightsDateRangeForMonth(year, selectedMonth);
    const extended = await ctx.reportingInsightsAggregatorService.getExtendedInsights(
      ctx.companyId,
      dateRange,
      selectedMonth,
      ctx.now,
    );
    const payload = extended.dashboardInsights;
    const effectiveFocus = resolveEffectiveDashboardInsightsFocus(ctx.query, kind);

    let { answerAr, answerEn } = buildAnswer(effectiveFocus, extended, year, selectedMonth);

    const poolLlm = filterMergedByFocus(effectiveFocus, extended.warnings);
    const maxLlmPick = effectiveFocus === 'overview' ? 3 : 5;
    const pickedForLlm = poolLlm.slice(0, maxLlmPick);

    if (ctx.insightsLlmExplain && pickedForLlm.length > 0) {
      try {
        const explanationPack = buildExtendedInsightsExplanationPackage(extended, effectiveFocus, year, selectedMonth);
        const packStr = JSON.stringify(explanationPack);
        const llmOut = await ctx.insightsLlmExplain(ctx.query, explanationPack, {
          prefersArabic: queryLooksArabic(ctx.query),
        });
        if (llmOut && validateInsightsLlmAnswer(llmOut, packStr)) {
          answerAr = llmOut.answerAr;
          answerEn = llmOut.answerEn;
        }
      } catch {
        /* الرد الحتمي */
      }
    }

    return { answerAr, answerEn };
  },
};

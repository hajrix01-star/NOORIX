/**
 * reportHelpers — دوال مساعدة لتقارير ربح وخسارة
 */
import { fmt } from '../../utils/format';
import type { GeneralProfitLossReport, PlDisplayRow, PlRowType } from './reportTypes';

export const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const PERCENT_COLOR = '#0d9488';

export function isEmptyMetric(value: unknown) {
  if (value == null || value === '') return true;
  const num = Number(value);
  return !Number.isFinite(num) || Math.abs(num) < 0.0000001;
}

export function formatSmartNumber(value: unknown, decimals = 1) {
  if (isEmptyMetric(value)) return '-';
  return Number(value).toLocaleString('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function amountText(value: unknown) {
  if (isEmptyMetric(value)) return '-';
  return fmt(value, 0);
}

export function moneyText(value: unknown) {
  const text = amountText(value);
  return text === '-' ? '-' : `${text} SAR`;
}

/** قيمة لـ MetricCard.Value (رقم أو '-' للعرض كنص) — العملة تُمرَّر عبر currency="SR" */
export function metricCardAmountValue(value: unknown) {
  if (isEmptyMetric(value)) return '-';
  return Math.round(Number(value));
}

export function percentText(value: unknown) {
  return isEmptyMetric(value) ? '-' : `${fmt(value, 1)}%`;
}

export function truncateText(value: unknown, max = 42) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function displayLabel(row: PlDisplayRow, lang: string) {
  return lang === 'en' ? (row.labelEn || row.labelAr || '—') : (row.labelAr || row.labelEn || '—');
}

export function getContextAmount(row: PlDisplayRow, selectedMonth: number | null | undefined) {
  return selectedMonth ? row?.months?.[selectedMonth - 1] : row?.total;
}

export function getContextPercent(row: PlDisplayRow, selectedMonth: number | null | undefined) {
  return selectedMonth ? row?.percentOfSalesMonths?.[selectedMonth - 1] : row?.percentOfSalesYear;
}

export function getRowTone(row: PlDisplayRow) {
  if (row.rowType === 'summary' || row.rowType === 'group') {
    const bg = 'rgba(15,23,42,0.055)';
    const borderTop = '1px solid rgba(15,23,42,0.12)';
    return { bg, stickyBg: bg, accent: 'var(--noorix-text)', isSummary: row.rowType === 'summary', borderTop };
  }
  return { bg: 'transparent', stickyBg: 'var(--noorix-bg-surface)', accent: 'var(--noorix-text)', isSummary: false };
}

function flattenExpenseTree(
  items: readonly PlDisplayRow[] | undefined,
  groupKey: string,
  collapsedGroups: Record<string, boolean>,
  depth = 0,
): PlDisplayRow[] {
  const rows: PlDisplayRow[] = [];
  for (const node of items || []) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isCategory = node.key?.startsWith('category:');
    const collapseKey = isCategory ? node.key : null;
    const isCollapsed = !!(collapseKey && collapsedGroups[collapseKey]);
    rows.push({
      ...node,
      rowType: hasChildren ? 'category' : 'item',
      groupKey,
      itemKey: node.key,
      collapseKey,
      depth,
    });
    if (hasChildren && !isCollapsed) {
      rows.push(...flattenExpenseTree(node.children, groupKey, collapsedGroups, depth + 1));
    }
  }
  return rows;
}

export function buildFlatRows(
  report: GeneralProfitLossReport | null | undefined,
  collapsedGroups: Record<string, boolean> = {},
): PlDisplayRow[] {
  const rows: PlDisplayRow[] = [];
  for (const group of report?.groups || []) {
    rows.push({ ...group, rowType: 'group', groupKey: group.key, itemKey: null });
    if (Array.isArray(group.items) && group.items.some((i) => i.children)) {
      rows.push(...flattenExpenseTree(group.items, group.key, collapsedGroups));
    } else {
      for (const item of group.items || []) {
        rows.push({ ...item, rowType: 'item', groupKey: group.key, itemKey: item.key });
      }
    }
  }
  for (const summary of report?.summaryRows || []) {
    rows.push({ ...summary, rowType: 'summary', groupKey: summary.key, itemKey: null });
  }
  return rows;
}

export function buildVisibleRows(
  rows: readonly PlDisplayRow[],
  collapsedGroups: Record<string, boolean>,
): PlDisplayRow[] {
  return rows.filter((row) => {
    if (row.rowType !== 'item' && row.rowType !== 'category') return true;
    return !collapsedGroups[row.groupKey ?? ''];
  });
}

/** يجمع مفاتيح category:* التي لها أبناء — لطي الأفرع تحت فئة (أي مجموعة بها شجرة) */
function collectCategoryKeysWithChildren(nodes: readonly PlDisplayRow[]): string[] {
  const keys: string[] = [];
  const walk = (list: readonly PlDisplayRow[]) => {
    for (const node of list || []) {
      const ch = Array.isArray(node?.children) ? node.children : [];
      if (node?.key?.startsWith('category:') && ch.length > 0) {
        keys.push(node.key);
        walk(ch);
      } else if (ch.length) walk(ch);
    }
  };
  walk(nodes || []);
  return keys;
}

/** مستويات عرض التقرير: 1 = أقسام + ملخص فقط، 2 = أول طبقة بنود، 3 = الشجرة كاملة */
export type PlDisplayLevel = 1 | 2 | 3;

/**
 * حالة الطي الافتراضية لمستوى العرض (1–3).
 * - المستوى 1: إخفاء كل بنود المبيعات/المشتريات/المصاريف (يظهر رأس القسم والملخصات فقط).
 * - المستوى 2: إظهار أول طبقة تحت كل قسم (فئات الجذر ظاهرة، أفرع الفئات مطوية).
 * - المستوى 3: توسيع كل الفئات.
 */
export function buildCollapsedGroupsForLevel(
  report: GeneralProfitLossReport | null | undefined,
  level: PlDisplayLevel,
): Record<string, boolean> {
  if (level === 3) {
    return { sales: false, purchases: false, expenses: false };
  }
  if (level === 1) {
    return { sales: true, purchases: true, expenses: true };
  }
  const out: Record<string, boolean> = { sales: false, purchases: false, expenses: false };
  for (const g of report?.groups || []) {
    if (Array.isArray(g.items) && g.items.some((i) => i.children)) {
      for (const k of collectCategoryKeysWithChildren(g.items)) {
        out[k] = true;
      }
    }
  }
  return out;
}

/** تصفية صفوف الجدول المعروضة حسب نص البحث (يبقي رؤوس الأقسام والملخص) */
export function filterVisibleRowsByLabel(rows: readonly PlDisplayRow[], query: string, lang: string): PlDisplayRow[] {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((row) => {
    if (row.rowType === 'group' || row.rowType === 'summary') return true;
    const lab = String(displayLabel(row, lang) || '').toLowerCase();
    return lab.includes(q);
  });
}

/**
 * أعمدة إيرادات / مشتريات / مصاريف للتصدير إلى Excel: رقم في عمود الفئة فقط لصفوف البند والتصنيف
 * (بدون صف المجموعة لتفادي ازدواجية مع جمع البنود تحتها).
 */
function plCategorySplitNumericCells(row: PlDisplayRow, selectedMonth: number | null | undefined) {
  const empty = '' as const;
  if (row.rowType === 'summary' || row.rowType === 'group') {
    return { sales: empty, purchases: empty, expenses: empty };
  }
  const gk = row.groupKey;
  const raw = getContextAmount(row, selectedMonth ?? undefined);
  if (isEmptyMetric(raw)) return { sales: empty, purchases: empty, expenses: empty };
  const n = Math.round(Number(raw));
  if (gk === 'sales') return { sales: n, purchases: empty, expenses: empty };
  if (gk === 'purchases') return { sales: empty, purchases: n, expenses: empty };
  if (gk === 'expenses') return { sales: empty, purchases: empty, expenses: n };
  return { sales: empty, purchases: empty, expenses: empty };
}

/** صفوف تصدير Excel/PDF من صفوف مسطّحة معروضة (نفس مستوى العرض والطي) */
export function buildExportRowsFromVisibleRows(
  rows: readonly PlDisplayRow[],
  lang: string,
  t: (key: string) => string,
  selectedMonth: number | null | undefined,
  exportOpts?: { amountColumnTitle?: string },
) {
  const amountCol =
    selectedMonth && exportOpts?.amountColumnTitle
      ? exportOpts.amountColumnTitle
      : selectedMonth
        ? t('selectedMonth')
        : null;

  return rows.map((row) => {
    const indent = '  '.repeat(row.depth || 0) + (row.rowType === 'item' ? '  ' : '');
    const base: Record<string, string | number> = {
      [t('reportItem')]: `${indent}${displayLabel(row, lang)}`,
    };
    const split = plCategorySplitNumericCells(row, selectedMonth ?? null);
    base[t('revenueGroup')] = split.sales === '' ? '' : split.sales;
    base[t('purchasesGroup')] = split.purchases === '' ? '' : split.purchases;
    base[t('expensesGroup')] = split.expenses === '' ? '' : split.expenses;
    if (selectedMonth && amountCol) {
      base[amountCol] = amountText(getContextAmount(row, selectedMonth));
      base[t('reportSalesShareMonth')] = percentText(getContextPercent(row, selectedMonth));
    }
    if (!selectedMonth) {
      EN_MONTHS.forEach((month, index) => {
        base[month] = amountText(row?.months?.[index]);
      });
      base[t('reportAnnualTotal')] = amountText(row?.total);
      base[t('reportSalesShareYear')] = percentText(row?.percentOfSalesYear);
    }
    return base;
  });
}

export function buildExportRows(
  report: GeneralProfitLossReport,
  lang: string,
  t: (key: string) => string,
  selectedMonth: number | null | undefined,
  exportOpts?: { amountColumnTitle?: string },
) {
  return buildExportRowsFromVisibleRows(buildFlatRows(report, {}), lang, t, selectedMonth, exportOpts);
}

/** تصدير PDF/Excel — صفوف ملخص فقط (أقسام + إجمالي/صافي) */
export function filterProfitLossExportSummaryOnly<T extends Record<string, unknown>>(
  rows: T[],
  metas: Array<{ rowType?: string }>,
): { rows: T[]; metas: Array<{ rowType?: string }> } {
  const outRows: T[] = [];
  const outMetas: Array<{ rowType?: string }> = [];
  for (let i = 0; i < rows.length; i++) {
    const m = metas[i];
    if (m?.rowType === 'group' || m?.rowType === 'summary') {
      outRows.push(rows[i]);
      outMetas.push(m);
    }
  }
  return { rows: outRows, metas: outMetas };
}

/** بيانات وصفية لصف التصدير (Excel/PDF) — نفس ترتيب الصفوف الممرَّرة */
export function buildProfitLossExportRowMeta(
  report: GeneralProfitLossReport,
  selectedMonthNum: number | null,
  rows?: readonly PlDisplayRow[],
) {
  const src = rows !== undefined ? rows : buildFlatRows(report, {});
  return src.map((row) => ({
    rowType: row.rowType as PlRowType | 'groupTotal' | undefined,
    groupKey: (row.groupKey ?? null) as string | null,
    key: row.key as string | undefined,
    tone: profitLossSummaryTone(row, selectedMonthNum),
  }));
}

function profitLossSummaryTone(row: PlDisplayRow, selectedMonthNum: number | null): 'pos' | 'neg' | undefined {
  if (row.rowType !== 'summary' || (row.key !== 'netProfit' && row.key !== 'grossProfit')) return undefined;
  const amt =
    selectedMonthNum != null
      ? Number(row.months?.[selectedMonthNum - 1] ?? 0)
      : Number(row.total ?? 0);
  if (!Number.isFinite(amt)) return undefined;
  return amt >= 0 ? 'pos' : 'neg';
}

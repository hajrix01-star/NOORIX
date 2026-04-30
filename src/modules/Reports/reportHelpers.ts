/**
 * reportHelpers — دوال مساعدة لتقارير ربح وخسارة
 */
import { fmt } from '../../utils/format';

export const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const PERCENT_COLOR = '#0d9488';

export function isEmptyMetric(value: any) {
  if (value == null || value === '') return true;
  const num = Number(value);
  return !Number.isFinite(num) || Math.abs(num) < 0.0000001;
}

export function formatSmartNumber(value: any, decimals: any = 1) {
  if (isEmptyMetric(value)) return '-';
  return Number(value).toLocaleString('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function amountText(value: any) {
  if (isEmptyMetric(value)) return '-';
  return fmt(value, 0);
}

export function moneyText(value: any) {
  const text = amountText(value);
  return text === '-' ? '-' : `${text} SAR`;
}

/** قيمة لـ MetricCard.Value (رقم أو '-' للعرض كنص) — العملة تُمرَّر عبر currency="SR" */
export function metricCardAmountValue(value: any) {
  if (isEmptyMetric(value)) return '-';
  return Math.round(Number(value));
}

export function percentText(value: any) {
  return isEmptyMetric(value) ? '-' : `${fmt(value, 1)}%`;
}

export function truncateText(value: any, max: any = 42) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function displayLabel(row: any, lang: any) {
  return lang === 'en' ? (row.labelEn || row.labelAr || '—') : (row.labelAr || row.labelEn || '—');
}

export function getContextAmount(row: any, selectedMonth: any) {
  return selectedMonth ? row?.months?.[selectedMonth - 1] : row?.total;
}

export function getContextPercent(row: any, selectedMonth: any) {
  return selectedMonth ? row?.percentOfSalesMonths?.[selectedMonth - 1] : row?.percentOfSalesYear;
}

export function getRowTone(row: any) {
  if (row.rowType === 'summary') {
    const val = Number(row?.total || 0);
    const accent = val >= 0 ? '#2563eb' : '#dc2626';
    const bg = 'rgba(15,23,42,0.04)';
    const borderTop = '2px solid rgba(15,23,42,0.12)';
    return { bg, stickyBg: bg, accent, isSummary: true, borderTop };
  }
  if (row.groupKey === 'purchases') {
    return { bg: row.rowType === 'group' ? 'rgba(239,68,68,0.09)' : 'rgba(239,68,68,0.03)', stickyBg: row.rowType === 'group' ? 'rgba(239,68,68,0.09)' : 'rgba(255,255,255,0.98)', accent: '#dc2626', isSummary: false };
  }
  if (row.groupKey === 'expenses') {
    return { bg: row.rowType === 'group' ? 'rgba(217,119,6,0.09)' : 'rgba(217,119,6,0.035)', stickyBg: row.rowType === 'group' ? 'rgba(217,119,6,0.09)' : 'rgba(255,255,255,0.98)', accent: '#b45309', isSummary: false };
  }
  if (row.rowType === 'group') {
    return { bg: 'rgba(37,99,235,0.04)', stickyBg: 'rgba(37,99,235,0.04)', accent: '#2563eb', isSummary: false };
  }
  return { bg: 'transparent', stickyBg: 'var(--noorix-bg-surface)', accent: 'var(--noorix-text)', isSummary: false };
}

function flattenExpenseTree(items: any, groupKey: any, collapsedGroups: any, depth: any = 0): any[] {
  const rows: any[] = [];
  for (const node of items || []) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isCategory = node.key?.startsWith('category:');
    const collapseKey = isCategory ? node.key : null;
    const isCollapsed = !!(collapseKey && (collapsedGroups as Record<string, any>)[collapseKey]);
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

export function buildFlatRows(report: any, collapsedGroups: any = {}): any[] {
  const rows: any[] = [];
  for (const group of report?.groups || []) {
    rows.push({ ...group, rowType: 'group', groupKey: group.key, itemKey: null });
    if (Array.isArray(group.items) && group.items.some((i: any) => i.children)) {
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

export function buildVisibleRows(rows: any, collapsedGroups: any) {
  return rows.filter((row: any) => {
    if (row.rowType !== 'item' && row.rowType !== 'category') return true;
    return !collapsedGroups[row.groupKey];
  });
}

export function buildExportRows(
  report: any,
  lang: any,
  t: any,
  selectedMonth: number | null | undefined,
  exportOpts?: { amountColumnTitle?: string },
) {
  const rows = buildFlatRows(report, {});
  const amountCol =
    selectedMonth && exportOpts?.amountColumnTitle
      ? exportOpts.amountColumnTitle
      : selectedMonth
        ? t('selectedMonth')
        : null;

  return rows.map((row: any) => {
    const indent = '  '.repeat(row.depth || 0) + (row.rowType === 'item' ? '  ' : '');
    const base: Record<string, any> = {
      [t('reportItem')]: `${indent}${displayLabel(row, lang)}`,
    };
    if (selectedMonth && amountCol) {
      base[amountCol] = amountText(getContextAmount(row, selectedMonth));
      base[t('reportSalesShareMonth')] = percentText(getContextPercent(row, selectedMonth));
    }
    if (!selectedMonth) {
      EN_MONTHS.forEach((month: any, index: any) => {
        base[month] = amountText(row?.months?.[index]);
      });
    }
    base[t('reportAnnualTotal')] = amountText(row?.total);
    base[t('reportSalesShareYear')] = percentText(row?.percentOfSalesYear);
    return base;
  });
}

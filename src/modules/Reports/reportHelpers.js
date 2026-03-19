/**
 * reportHelpers — دوال مساعدة لتقارير ربح وخسارة
 */
import { CARD_COLORS } from '../../utils/cardStyles';

export const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export { CARD_COLORS };

export const PERCENT_COLOR = '#0d9488';

export function isEmptyMetric(value) {
  if (value == null || value === '') return true;
  const num = Number(value);
  return !Number.isFinite(num) || Math.abs(num) < 0.0000001;
}

export function formatSmartNumber(value, decimals = 1) {
  if (isEmptyMetric(value)) return '-';
  return Number(value).toLocaleString('en', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function amountText(value) {
  return formatSmartNumber(value, 1);
}

export function moneyText(value) {
  const text = amountText(value);
  return text === '-' ? '-' : `${text} ﷼`;
}

export function percentText(value) {
  return isEmptyMetric(value) ? '-' : `${formatSmartNumber(value, 1)}%`;
}

export function truncateText(value, max = 42) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function displayLabel(row, lang) {
  return lang === 'en' ? (row.labelEn || row.labelAr || '—') : (row.labelAr || row.labelEn || '—');
}

export function getContextAmount(row, selectedMonth) {
  return selectedMonth ? row?.months?.[selectedMonth - 1] : row?.total;
}

export function getContextPercent(row, selectedMonth) {
  return selectedMonth ? row?.percentOfSalesMonths?.[selectedMonth - 1] : row?.percentOfSalesYear;
}

export function getRowTone(row) {
  if (row.rowType === 'summary') {
    const val = Number(row?.total || 0);
    const accent = val >= 0 ? '#2563eb' : '#dc2626';
    const bg = 'rgba(15,23,42,0.04)';
    const borderTop = '2px solid rgba(15,23,42,0.12)';
    return { bg, stickyBg: bg, accent, isSummary: true, borderTop };
  }
  if (row.groupKey === 'purchases') {
    return { bg: row.rowType === 'group' ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.03)', stickyBg: row.rowType === 'group' ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.98)', accent: '#dc2626', isSummary: false };
  }
  if (row.groupKey === 'expenses') {
    return { bg: row.rowType === 'group' ? 'rgba(220,38,38,0.09)' : 'rgba(220,38,38,0.035)', stickyBg: row.rowType === 'group' ? 'rgba(220,38,38,0.09)' : 'rgba(255,255,255,0.98)', accent: '#b91c1c', isSummary: false };
  }
  if (row.rowType === 'group') {
    return { bg: 'rgba(37,99,235,0.04)', stickyBg: 'rgba(37,99,235,0.04)', accent: '#2563eb', isSummary: false };
  }
  return { bg: 'transparent', stickyBg: 'var(--noorix-bg-surface)', accent: 'var(--noorix-text)', isSummary: false };
}

function flattenExpenseTree(items, groupKey, collapsedGroups, depth = 0) {
  const rows = [];
  for (const node of items || []) {
    const hasChildren = Array.isArray(node.children) && node.children.length > 0;
    const isCategory = node.key?.startsWith('category:');
    const collapseKey = isCategory ? node.key : null;
    const isCollapsed = collapseKey && collapsedGroups[collapseKey];
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

export function buildFlatRows(report, collapsedGroups = {}) {
  const rows = [];
  for (const group of report?.groups || []) {
    rows.push({ ...group, rowType: 'group', groupKey: group.key, itemKey: null });
    if (group.key === 'expenses' && Array.isArray(group.items) && group.items.some((i) => i.children)) {
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

export function buildVisibleRows(rows, collapsedGroups) {
  return rows.filter((row) => {
    if (row.rowType !== 'item' && row.rowType !== 'category') return true;
    return !collapsedGroups[row.groupKey];
  });
}

export function buildExportRows(report, lang, t, selectedMonth) {
  const rows = buildFlatRows(report, {});
  return rows.map((row) => {
    const indent = '  '.repeat(row.depth || 0) + (row.rowType === 'item' ? '  ' : '');
    const base = {
      [t('reportItem')]: `${indent}${displayLabel(row, lang)}`,
    };
    if (selectedMonth) {
      base[t('selectedMonth')] = amountText(getContextAmount(row, selectedMonth));
      base[t('reportSalesShare')] = percentText(getContextPercent(row, selectedMonth));
    }
    EN_MONTHS.forEach((month, index) => {
      base[month] = amountText(row?.months?.[index]);
    });
    base[t('reportAnnualTotal')] = amountText(row?.total);
    base[`${t('reportSalesShare')} (${t('reportYear')})`] = percentText(row?.percentOfSalesYear);
    return base;
  });
}

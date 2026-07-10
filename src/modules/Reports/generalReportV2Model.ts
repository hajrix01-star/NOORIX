import { amountText, displayLabel, getContextAmount, getContextPercent, percentText } from './reportHelpers';
import type { PlDisplayRow } from './reportTypes';

const NEGATIVE_GROUPS = new Set(['purchases', 'expenses']);

export function escReportHtml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function groupToneClass(row: PlDisplayRow): string {
  if (row.rowType === 'groupTotal') return 'is-group-total';
  if (NEGATIVE_GROUPS.has(String(row.groupKey || row.key || ''))) return 'is-negative';
  if (row.rowType === 'summary' && Number(row.total || 0) < 0) return 'is-negative';
  if (row.rowType === 'summary') return 'is-summary';
  return '';
}

export function lineIndentClass(row: PlDisplayRow): string {
  if (row.rowType === 'groupTotal' || row.rowType === 'summary') return 'nx-gr2-line--indent-total';
  const depth = Math.max(0, Math.min(4, Number(row.depth || 0)));
  return `nx-gr2-line--indent-${depth}`;
}

export function displayV2RowLabel(row: PlDisplayRow, lang: string): string {
  const label = displayLabel(row, lang);
  if (row.rowType !== 'groupTotal') return label;
  return `Total ${label}`;
}

export function buildStatementRowsForV2(rows: readonly PlDisplayRow[]): PlDisplayRow[] {
  const result: PlDisplayRow[] = [];
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.rowType !== 'group') {
      if (row.rowType === 'summary') result.push(row);
      continue;
    }
    const children: PlDisplayRow[] = [];
    let cursor = index + 1;
    while (cursor < rows.length && rows[cursor].rowType !== 'group' && rows[cursor].rowType !== 'summary') {
      children.push(rows[cursor]);
      cursor++;
    }
    if (children.length) result.push(...children, { ...row, rowType: 'groupTotal', originalRowType: 'group' });
    else result.push(row);
    index = cursor - 1;
  }
  return result;
}

export function buildV2ExportRows(
  rows: readonly PlDisplayRow[],
  opts: {
    lang: string;
    t: (key: string) => string;
    selectedMonthNumber: number | null;
    monthLabel: string;
    year: number;
    monthLabels: readonly string[];
  },
): Array<Record<string, string>> {
  const { lang, t, selectedMonthNumber, monthLabel, year, monthLabels } = opts;
  return rows.map((row) => {
    const indent = row.rowType === 'groupTotal' || row.rowType === 'summary' || row.rowType === 'group'
      ? ''
      : '  '.repeat((row.depth || 0) + 1);
    const base: Record<string, string> = {
      [t('reportItem')]: `${indent}${displayV2RowLabel(row, lang)}`,
    };
    if (selectedMonthNumber) {
      base[`${monthLabel} ${year}`] = amountText(getContextAmount(row, selectedMonthNumber));
      base['%'] = percentText(getContextPercent(row, selectedMonthNumber));
      return base;
    }
    monthLabels.forEach((label, index) => {
      base[label] = amountText(row.months?.[index]);
    });
    base[t('reportAnnualTotal')] = amountText(row.total);
    base['%'] = percentText(row.percentOfSalesYear);
    return base;
  });
}

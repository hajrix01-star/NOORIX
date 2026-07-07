import { amountText, displayLabel, getContextAmount, getContextPercent, percentText } from './reportHelpers';
import type { GeneralProfitLossReport, PlDisplayRow } from './reportTypes';
import { buildPrintHtmlTable, type PrintHtmlTableRow } from '../../utils/printTableHtml';

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

export function buildPrintableGeneralReportV2Html(params: {
  report: GeneralProfitLossReport;
  visibleRows: readonly PlDisplayRow[];
  selectedMonthNumber: number | null;
  monthLabel: string;
  year: number;
  lang: string;
  t: (key: string) => string;
  companyName: string;
}): string {
  const { report, visibleRows, selectedMonthNumber, monthLabel, year, lang, t, companyName } = params;
  const period = selectedMonthNumber ? `${monthLabel} ${year}` : String(year);
  const headerCells = [
    { value: t('reportItem') },
    ...(selectedMonthNumber ? [{ value: monthLabel }] : report.months.map((month) => ({ value: month.label }))),
    ...(selectedMonthNumber ? [] : [{ value: t('reportAnnualTotal') }]),
    { value: '%' },
  ];
  const tableRows: PrintHtmlTableRow[] = visibleRows.map((row) => {
    const rowTone = groupToneClass(row);
    const amountClass = rowTone === 'is-negative' ? ' neg' : '';
    const amountCells = selectedMonthNumber
      ? [{ value: amountText(getContextAmount(row, selectedMonthNumber)), className: `amt${amountClass}` }]
      : row.months.map((value) => ({ value: amountText(value), className: `amt${amountClass}` }));
    const totalCell = selectedMonthNumber ? [] : [{ value: amountText(row.total), className: `amt${amountClass}` }];
    const pct = selectedMonthNumber ? getContextPercent(row, selectedMonthNumber) : row.percentOfSalesYear;
    return {
      className: `${row.rowType} ${rowTone}`,
      cells: [
        { value: displayV2RowLabel(row, lang), className: 'label', style: `padding-inline-start:${10 + (row.depth || 0) * 14}px` },
        ...amountCells,
        ...totalCell,
        { value: percentText(pct), className: 'pct' },
      ],
    };
  });
  const reportTable = buildPrintHtmlTable({
    wrapperClassName: null,
    headerRows: [{ cells: headerCells }],
    bodyRows: tableRows,
  });
  return `<!DOCTYPE html>
<html dir="${lang === 'en' ? 'ltr' : 'rtl'}" lang="${lang === 'en' ? 'en' : 'ar'}">
<head>
<meta charset="utf-8">
<title>${escReportHtml(t('reportGeneralV2'))}</title>
<style>
@page { size: A4 ${selectedMonthNumber ? 'portrait' : 'landscape'}; margin: 10mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; background: #eef2f7; color: #0f172a; font-family: Cairo, Tahoma, Arial, sans-serif; }
.toolbar { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border-bottom: 1px solid #d8e2ef; }
.toolbar strong { font-size: 14px; }
.toolbar button { border: 1px solid #b9c8da; background: #185fa5; color: #fff; border-radius: 6px; padding: 8px 16px; font-weight: 800; cursor: pointer; }
.sheet { width: ${selectedMonthNumber ? '190mm' : '276mm'}; min-height: ${selectedMonthNumber ? '277mm' : '190mm'}; margin: 18px auto; background: #fff; border: 1px solid #d8e2ef; box-shadow: 0 14px 35px rgba(15,23,42,.12); padding: 14mm; }
.head { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; border-bottom: 3px solid #185fa5; padding-bottom: 12px; margin-bottom: 14px; }
.head h1 { margin: 0; font-size: 22px; line-height: 1.2; font-weight: 900; }
.meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.meta span { border: 1px solid #d8e2ef; background: #f8fafc; border-radius: 999px; padding: 4px 10px; font-size: 11px; font-weight: 800; color: #334155; }
.brand { text-align: end; font-weight: 900; font-size: 18px; color: #0f172a; }
table { width: 100%; border-collapse: separate; border-spacing: 0; overflow: hidden; border: 1px solid #cbd5e1; border-radius: 8px; }
thead th { background: linear-gradient(180deg, #12385f 0%, #0f2746 100%); color: #fff; font-size: 11px; font-weight: 900; padding: 9px 8px; border-inline-end: 1px solid rgba(255,255,255,.14); }
tbody td { padding: 8px; border-top: 1px solid #dbe5f0; border-inline-end: 1px solid #e7eef6; font-size: 11.5px; font-weight: 700; }
tbody tr:nth-child(even) td { background: #f8fafc; }
td.label { text-align: start; font-size: 12px; color: #172033; }
td.amt, td.pct { text-align: center; direction: ltr; font-variant-numeric: tabular-nums; }
td.neg, tr.is-negative td { color: #991b1b; }
tr.groupTotal td { background: #eaf3ff !important; color: #0f3b68; font-weight: 900; border-top: 2px solid #9bc3ea; }
tr.summary td { background: #eaf3ff !important; color: #0f3b68; font-size: 12px; font-weight: 900; border-top: 2px solid #9bc3ea; }
tr.is-summary td.amt { color: #047857; }
.footer { margin-top: 12px; text-align: center; color: #64748b; font-size: 10px; }
@media print {
  body { background: #fff; }
  .toolbar { display: none; }
  .sheet { width: auto; min-height: 0; margin: 0; padding: 0; border: 0; box-shadow: none; }
}
</style>
</head>
<body>
<div class="toolbar"><strong>${escReportHtml(t('reportGeneralV2'))} - ${escReportHtml(period)}</strong><button onclick="window.print()">${escReportHtml(t('print'))}</button></div>
<main class="sheet">
  <header class="head">
    <div>
      <h1>${escReportHtml(t('reportGeneralV2'))}</h1>
      <div class="meta"><span>${escReportHtml(period)}</span><span>${escReportHtml(t('reportAmountBasisGrossShort'))}</span></div>
    </div>
    <div class="brand">${escReportHtml(companyName || t('reports'))}</div>
  </header>
  ${reportTable}
  <div class="footer">${escReportHtml(period)}</div>
</main>
</body>
</html>`;
}

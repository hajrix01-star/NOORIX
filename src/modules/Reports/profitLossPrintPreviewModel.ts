import type { PrintDocumentHtmlOptions } from '../../utils/printUtils';
import { buildPrintHtmlTable, escapePrintHtml } from '../../utils/printTableHtml';
import { EN_MONTHS, amountText, displayLabel, isEmptyMetric, percentText } from './reportHelpers';
import type { PlDisplayRow } from './reportTypes';
import { periodAmount, rowIdentity, type ComparisonColumnPeriod } from './reportsComparablePeriodModel';

type Translate = (key: string, ...args: unknown[]) => string;

type ProfitLossPrintPreviewInput = {
  activePeriodColumns: ComparisonColumnPeriod[];
  companyLogoUrl: string;
  companyName: string;
  compareColumnPeriods: ComparisonColumnPeriod[];
  compareRows: Map<string, PlDisplayRow>;
  currentColumnPeriod: ComparisonColumnPeriod | null;
  lang: string;
  reportTitle: string;
  reportsFallbackTitle: string;
  rows: PlDisplayRow[];
  t: Translate;
  year: number;
};

export type ProfitLossPrintPreviewDocument = PrintDocumentHtmlOptions & {
  previewTitle?: string;
};

export function buildProfitLossPrintPreviewDocument({
  activePeriodColumns,
  companyLogoUrl,
  companyName,
  compareColumnPeriods,
  compareRows,
  currentColumnPeriod,
  lang,
  reportTitle,
  reportsFallbackTitle,
  rows,
  t,
  year,
}: ProfitLossPrintPreviewInput): ProfitLossPrintPreviewDocument {
  const printLang = lang === 'en' ? 'en' : 'ar';
  const printDir = lang === 'en' ? 'ltr' : 'rtl';
  const isPeriodPrint = currentColumnPeriod != null;
  const comparisonPrintColumns = isPeriodPrint ? compareColumnPeriods : [];
  const currentColumnTitle = currentColumnPeriod?.label ?? '';
  const headerCells = isPeriodPrint
    ? [
        { value: t('reportItem'), align: 'start' as const, className: 'pl-print-label-head' },
        { value: currentColumnTitle, align: 'center' as const, className: 'pl-print-number-head' },
        ...comparisonPrintColumns.map((column) => ({
          value: column.label,
          align: 'center' as const,
          className: 'pl-print-number-head',
        })),
      ]
    : [
        { value: t('reportItem'), align: 'start' as const, className: 'pl-print-label-head' },
        ...EN_MONTHS.map((month) => ({ value: month, align: 'center' as const, className: 'pl-print-number-head' })),
        { value: t('reportAnnualTotal'), align: 'center' as const, className: 'pl-print-number-head' },
        { value: t('reportSalesShareYear'), align: 'center' as const, className: 'pl-print-number-head' },
      ];

  return {
    title: reportTitle,
    companyName: companyName || reportsFallbackTitle,
    logoUrl: companyLogoUrl,
    subtitle: isPeriodPrint
      ? `${currentColumnTitle}${comparisonPrintColumns.length ? ` · ${activePeriodColumns.map((column) => column.label).join('، ')}` : ''}`
      : `${year} · ${t('reportGeneral')}`,
    landscape: !isPeriodPrint || comparisonPrintColumns.length > 2,
    htmlLang: printLang,
    htmlDir: printDir,
    showPageCounter: false,
    pageMarginMm: isPeriodPrint ? 8 : 6,
    extraCss: profitLossUnifiedPrintCss(),
    body: buildPrintHtmlTable({
      wrapperClassName: 'pl-print-wrap',
      tableClassName: 'print-table pl-print-table',
      headerRows: [{ cells: headerCells }],
      bodyRows: rows.map((row) => ({
        className: row.rowType === 'summary' || row.rowType === 'group' ? 'pl-print-total-row' : '',
        cells: [
          {
            value: displayLabel(row, lang),
            align: 'start' as const,
            className: `pl-print-label pl-print-depth-${Math.max(0, Math.min(3, Number(row.depth || 0)))}`,
          },
          ...buildProfitLossPrintAmountCells({
            compareRows,
            comparisonPrintColumns,
            currentColumnPeriod,
            isPeriodPrint,
            row,
          }),
        ],
      })),
    }),
  };
}

function buildProfitLossPrintAmountCells({
  compareRows,
  comparisonPrintColumns,
  currentColumnPeriod,
  isPeriodPrint,
  row,
}: {
  compareRows: Map<string, PlDisplayRow>;
  comparisonPrintColumns: ComparisonColumnPeriod[];
  currentColumnPeriod: ComparisonColumnPeriod | null;
  isPeriodPrint: boolean;
  row: PlDisplayRow;
}) {
  if (isPeriodPrint && currentColumnPeriod) {
    return [
      printAmountCell(
        periodAmount(row, currentColumnPeriod.period),
        currentColumnPeriod.period.month ? row.percentOfSalesMonths?.[currentColumnPeriod.period.month - 1] : null,
      ),
      ...comparisonPrintColumns.map((column) => {
        const compareRow = compareRows.get(`${column.period.year}:${rowIdentity(row)}`);
        return printAmountCell(compareRow ? periodAmount(compareRow, column.period) : null, null);
      }),
    ];
  }

  return [
    ...(row.months ?? []).map((value, index) => printAmountCell(value, row.percentOfSalesMonths?.[index])),
    printAmountCell(row.total, row.percentOfSalesYear),
    printPlainCell(row.percentOfSalesYear),
  ];
}

function printAmountCell(amount: unknown, percent: unknown) {
  const amountHtml = isEmptyMetric(amount) ? '' : escapePrintHtml(amountText(amount));
  const percentHtml = isEmptyMetric(percent) ? '' : `<span>${escapePrintHtml(percentText(percent))}</span>`;
  return {
    html: amountHtml || percentHtml ? `<strong>${amountHtml}</strong>${percentHtml}` : '',
    align: 'center' as const,
    className: 'pl-print-number',
  };
}

function printPlainCell(value: unknown) {
  return {
    value: isEmptyMetric(value) ? '' : percentText(value),
    align: 'center' as const,
    className: 'pl-print-number pl-print-percent-only',
  };
}

function profitLossUnifiedPrintCss() {
  return `
.pl-print-wrap {
  width: 100%;
  overflow: visible;
}
.pl-print-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  overflow: hidden;
  table-layout: fixed;
}
.pl-print-table thead {
  display: table-header-group;
}
.pl-print-table th {
  background: #1d5fa7;
  color: #ffffff;
  border-color: rgba(255,255,255,.22);
  padding: 8px 7px;
  text-align: center;
  font-size: 11px;
  font-weight: 900;
  line-height: 1.25;
}
.pl-print-table td {
  border-color: #dbe5f0;
  padding: 7px 8px;
  color: #172033;
  font-size: 10.8px;
  font-weight: 750;
  line-height: 1.3;
  page-break-inside: avoid;
  vertical-align: middle;
}
.pl-print-table tr:nth-child(even) td {
  background: #f8fafc;
}
.pl-print-table .pl-print-total-row td {
  background: #e8eef5 !important;
  color: #0f172a;
  font-weight: 900;
}
.pl-print-label-head,
.pl-print-label {
  text-align: start !important;
}
.pl-print-label {
  white-space: normal;
}
.pl-print-depth-1 { padding-inline-start: 20px !important; }
.pl-print-depth-2 { padding-inline-start: 34px !important; color: #475569 !important; }
.pl-print-depth-3 { padding-inline-start: 48px !important; color: #64748b !important; }
.pl-print-number {
  direction: ltr;
  text-align: center !important;
  font-variant-numeric: tabular-nums;
  unicode-bidi: isolate;
}
.pl-print-number strong {
  display: block;
  min-height: 12px;
  color: #172033;
  font-size: 10.8px;
  font-weight: 900;
}
.pl-print-number span {
  display: block;
  margin-top: 2px;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
}
.pl-print-percent-only {
  color: #64748b !important;
  font-size: 11px !important;
  font-weight: 850 !important;
}
@media print {
  .pl-print-table td,
  .pl-print-table th {
    break-inside: avoid;
  }
}
`;
}

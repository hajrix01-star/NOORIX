import { buildPrintDocumentHtml } from '../../utils/printUtils';
import { amountText, percentText } from './reportHelpers';
import { displayV2RowLabel, groupToneClass } from './generalReportV2Model';
import { periodAmount, rowIdentity, type ComparablePeriod, type ComparisonColumnPeriod } from './reportsComparablePeriodModel';
import type { GeneralProfitLossReport, PlDisplayRow } from './reportTypes';

export type GeneralReportV2PrintInput = {
  report: GeneralProfitLossReport | null | undefined;
  visibleRows: PlDisplayRow[];
  compareRows: Map<string, PlDisplayRow>;
  compareColumnPeriods: ComparisonColumnPeriod[];
  currentPeriod: ComparablePeriod;
  compareEnabled: boolean;
  periodTitle: string;
  compareTitle: string;
  year: number;
  lang: string;
  t: (key: string) => string;
  companyName: string;
  companyLogoUrl: string;
  currentNetProfit: number;
  currentGrossProfit: number;
  currentMargin: number;
  formatChange: (current: number, previous: number) => string;
};

export function buildGeneralReportV2PrintHtml(input: GeneralReportV2PrintInput) {
  const {
    report,
    visibleRows,
    compareRows,
    compareColumnPeriods,
    currentPeriod,
    compareEnabled,
    periodTitle,
    compareTitle,
    year,
    lang,
    t,
    companyName,
    companyLogoUrl,
    currentNetProfit,
    currentGrossProfit,
    currentMargin,
    formatChange,
  } = input;
  const isArabic = lang !== 'en';
  const isYear = currentPeriod.mode === 'year';
  const headerCells = isYear
    ? [
        t('reportItem'),
        ...(report?.months || []).map((month) => month.label),
        t('reportAnnualTotal'),
        '%',
      ]
    : [
        t('reportItem'),
        `${year} ${periodTitle}`,
        ...(compareEnabled ? [...compareColumnPeriods.map((item) => item.label), '%'] : []),
      ];

  const rowsHtml = visibleRows.map((row) => {
    const tone = groupToneClass(row);
    const rowKind = row.rowType === 'summary' || row.rowType === 'groupTotal' ? ' total-row' : tone ? ` ${tone}` : '';
    const depth = row.rowType === 'summary' || row.rowType === 'groupTotal' ? 0 : Math.max(0, Math.min(3, Number(row.depth || 0)));
    const label = escReportHtml(displayV2RowLabel(row, lang));
    const cells = isYear
      ? [
          ...(report?.months || []).map((month) => amountText(row.months?.[month.index - 1])),
          amountText(row.total),
          percentText(row.percentOfSalesYear),
        ]
      : buildComparisonPrintCells({
          row,
          currentPeriod,
          compareEnabled,
          compareRows,
          compareColumnPeriods,
          formatChange,
        });
    return `<tr class="${rowKind.trim()}"><td class="label" style="padding-inline-start:${12 + depth * 22}px">${label}</td>${cells.map((cell) => `<td class="num">${escReportHtml(cell)}</td>`).join('')}</tr>`;
  }).join('');

  const printBody = `
<main class="gr-v2-print-sheet">
  <section class="gr-v2-print-title">
    <div>
      <h1>${escReportHtml(t('reportGeneralV2'))}</h1>
      <div class="gr-v2-print-meta">
        <span>${escReportHtml(periodTitle)}</span>
        ${compareEnabled ? `<span>${escReportHtml(isArabic ? 'مقارنة مع' : 'Compared with')} ${escReportHtml(compareTitle)}</span>` : ''}
        <span>${escReportHtml(t('reportAmountBasisGrossShort'))}</span>
      </div>
    </div>
  </section>
  <section class="gr-v2-print-summary">
    <div><span>${escReportHtml(t('annualNetProfit'))}</span><strong>${escReportHtml(amountText(currentNetProfit))} SR</strong></div>
    <div><span>${escReportHtml(t('annualGrossProfit'))}</span><strong>${escReportHtml(amountText(currentGrossProfit))} SR</strong></div>
    <div><span>${escReportHtml(isArabic ? 'هامش الربح' : 'Profit margin')}</span><strong>${escReportHtml(percentText(currentMargin))}</strong></div>
  </section>
  <table class="gr-v2-print-table">
    <thead><tr>${headerCells.map((cell) => `<th>${escReportHtml(cell)}</th>`).join('')}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <div class="gr-v2-print-note">${escReportHtml(periodTitle)}${compareEnabled ? ` | ${escReportHtml(compareTitle)}` : ''}</div>
</main>`;

  return buildPrintDocumentHtml({
    title: t('reportGeneralV2'),
    companyName: companyName || t('reports'),
    subtitle: compareEnabled ? `${periodTitle} | ${compareTitle}` : periodTitle,
    logoUrl: companyLogoUrl,
    landscape: isYear,
    body: printBody,
    extraCss: `${generalReportV2PrintCss}\n.gr-v2-print-sheet { width: ${isYear ? '276mm' : '190mm'}; }`,
    htmlDir: isArabic ? 'rtl' : 'ltr',
    htmlLang: isArabic ? 'ar' : 'en',
    autoPrint: true,
    pageMarginMm: 10,
  });
}

function buildComparisonPrintCells(input: {
  row: PlDisplayRow;
  currentPeriod: ComparablePeriod;
  compareEnabled: boolean;
  compareRows: Map<string, PlDisplayRow>;
  compareColumnPeriods: ComparisonColumnPeriod[];
  formatChange: (current: number, previous: number) => string;
}) {
  const { row, currentPeriod, compareEnabled, compareRows, compareColumnPeriods, formatChange } = input;
  const current = periodAmount(row, currentPeriod);
  if (!compareEnabled) return [amountText(current)];
  const compareRow = compareRows.get(rowIdentity(row));
  const previousValues = compareColumnPeriods.map((item) => (
    compareRow ? periodAmount(compareRow, item.period) : 0
  ));
  const previousTotal = previousValues.reduce((total, value) => total + value, 0);
  return [
    amountText(current),
    ...previousValues.map((value) => compareRow ? amountText(value) : '-'),
    compareRow ? formatChange(current, previousTotal) : '-',
  ];
}

export function escReportHtml(value: unknown) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const generalReportV2PrintCss = `
.print-header {
  display: grid;
  justify-items: center;
  gap: 3px;
  margin: 0 auto 14px;
  padding: 0 0 12px;
  text-align: center;
  border-bottom: 1px solid #d8d0c1;
}
.print-header img {
  margin: 0;
  width: 34px;
  height: 34px;
  max-height: 34px;
  object-fit: contain;
  border: 0;
  border-radius: 0;
  padding: 0;
}
.print-header h1 {
  margin: 0;
  color: #191814;
  font-size: 16px;
  line-height: 1.2;
  font-weight: 900;
}
.print-header .sub {
  margin: 0;
  color: #6f6a5f;
  font-size: 10.5px;
  line-height: 1.35;
  font-weight: 700;
}
.print-footer {
  margin-top: 16px;
  border-top-color: #e3dccf;
  color: #857d70;
}
.gr-v2-print-sheet {
  width: 190mm;
  max-width: 100%;
  margin: 0 auto;
}
.gr-v2-print-title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}
.gr-v2-print-title h1 {
  margin: 0;
  color: #191814;
  font-size: 18px;
  line-height: 1.2;
  font-weight: 900;
}
.gr-v2-print-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.gr-v2-print-meta span {
  border: 1px solid #ded6c8;
  background: #fbfaf7;
  border-radius: 999px;
  padding: 4px 10px;
  color: #5f584d;
  font-size: 11px;
  font-weight: 800;
}
.gr-v2-print-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 12px;
}
.gr-v2-print-summary div {
  border: 1px solid #ded6c8;
  background: #fbfaf7;
  border-radius: 8px;
  padding: 10px;
}
.gr-v2-print-summary span {
  display: block;
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
}
.gr-v2-print-summary strong {
  display: block;
  margin-top: 4px;
  direction: ltr;
  text-align: center;
  color: #191814;
  font-size: 15px;
  font-weight: 900;
}
.gr-v2-print-table {
  border-collapse: separate;
  border-spacing: 0;
  overflow: hidden;
  border: 1px solid #d8d0c1;
  border-radius: 10px;
}
.gr-v2-print-table thead { display: table-header-group; }
.gr-v2-print-table th {
  background: #137a4a;
  color: #fff;
  border-color: rgba(255,255,255,.2);
  padding: 7px 8px;
  text-align: center;
  font-size: 11px;
  font-weight: 900;
}
.gr-v2-print-table td {
  border-color: #e2dacd;
  padding: 8px;
  background: #ffffff;
  font-size: 11.5px;
  font-weight: 800;
  page-break-inside: avoid;
}
.gr-v2-print-table td.label {
  text-align: start;
  color: #24211c;
}
.gr-v2-print-table td.num {
  direction: ltr;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.gr-v2-print-table tr.total-row td,
.gr-v2-print-table tr.is-group-total td,
.gr-v2-print-table tr.is-summary td {
  background: #f1ece3 !important;
  color: #191814;
  font-weight: 900;
}
.gr-v2-print-note {
  margin-top: 12px;
  text-align: center;
  color: #64748b;
  font-size: 11px;
  font-weight: 800;
}
@media print {
  .gr-v2-print-sheet {
    width: auto;
    max-width: none;
  }
}
`;

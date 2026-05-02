/**
 * طباعة شهرية — قائمة دخل على صفحة A4 واحدة:
 * ملخص تنفيذي (مبيعات، مشتريات، ربح إجمالي، مصاريف، صافي) ثم تفاصيل البنود للشهر المحدد فقط.
 * كثافة الخط والـ zoom تتكيف مع عدد الصفوف لملاءمة صفحة واحدة قدر الإمكان.
 */
import {
  amountText,
  buildFlatRows,
  displayLabel,
  getContextAmount,
  getContextPercent,
  percentText,
} from './reportHelpers';

function esc(s: string) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function periodLine(t: (k: string) => string, monthLabel: string, year: number) {
  return t('reportPlPeriodMonth').replace('{month}', monthLabel).replace('{year}', String(year));
}

function monthIdx0(m: number) {
  return m - 1;
}

function groupMonthAmount(report: any, key: string, m: number): string {
  const g = report?.groups?.find((x: any) => x.key === key);
  return g?.months?.[monthIdx0(m)] ?? '0';
}

function summaryMonthAmount(report: any, key: string, m: number): string {
  const s = report?.summaryRows?.find((x: any) => x.key === key);
  return s?.months?.[monthIdx0(m)] ?? '0';
}

function pctOfPart(numer: string, denom: string): string {
  const a = Number(numer);
  const b = Number(denom);
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(b) < 1e-9) return '—';
  return `${((a / b) * 100).toFixed(1)}%`;
}

/** Zoom للطباعة (Chrome/Edge) — يضغط المحتوى نحو صفحة واحدة عند كثرة البنود */
export function getPlMonthPrintZoom(rowCount: number): number {
  if (rowCount <= 20) return 1;
  if (rowCount <= 28) return 0.94;
  if (rowCount <= 36) return 0.88;
  if (rowCount <= 46) return 0.82;
  if (rowCount <= 56) return 0.77;
  return 0.72;
}

function densityClass(rowCount: number): string {
  if (rowCount <= 24) return 'pl-density-comfortable';
  if (rowCount <= 36) return 'pl-density-normal';
  return 'pl-density-dense';
}

type TFn = (key: string) => string;

function buildExecutiveSummaryHtml(report: any, m: number, _lang: string, t: TFn): string {
  const sales = groupMonthAmount(report, 'sales', m);
  const pur = groupMonthAmount(report, 'purchases', m);
  const exp = groupMonthAmount(report, 'expenses', m);
  const gross = summaryMonthAmount(report, 'grossProfit', m);
  const net = summaryMonthAmount(report, 'netProfit', m);

  const cells = [
    { label: t('revenueGroup'), val: sales, sub: t('reportPlKpiSalesBase') },
    { label: t('purchasesGroup'), val: pur, sub: `${t('reportPlKpiOfSales')} ${pctOfPart(pur, sales)}` },
    { label: t('annualGrossProfit'), val: gross, sub: `${t('reportPlKpiOfSales')} ${pctOfPart(gross, sales)}` },
    { label: t('expensesGroup'), val: exp, sub: `${t('reportPlKpiOfSales')} ${pctOfPart(exp, sales)}` },
    { label: t('annualNetProfit'), val: net, sub: `${t('reportPlKpiOfSales')} ${pctOfPart(net, sales)}` },
  ];

  const kpiRow = cells
    .map((c) => {
      const subLine = c.sub ? `<div class="pl-kpi-sub">${esc(c.sub)}</div>` : '';
      return `<td class="pl-kpi-cell">
        <div class="pl-kpi-label">${esc(c.label)}</div>
        <div class="pl-kpi-val">${esc(amountText(c.val))} <span class="pl-sr">SR</span></div>
        ${subLine}
      </td>`;
    })
    .join('');

  return (
    `<section class="pl-exec-summary" aria-label="${esc(t('reportPlExecutiveSummary'))}">
      <h3 class="pl-section-title">${esc(t('reportPlExecutiveSummary'))}</h3>
      <table class="pl-kpi" role="presentation"><tr>${kpiRow}</tr></table>
      <p class="pl-formula-foot">${esc(t('reportPlFormulaSmart'))}</p>
    </section>`
  );
}

/** أنماط وثيقة قائمة الدخل — ملخص + تفاصيل شهر فقط، A4 */
export function plMonthStatementPrintCss(): string {
  return `
.pl-root { width: 100%; max-width: 190mm; margin: 0 auto; }
.pl-doc { margin: 0 auto; }
.pl-doc-title {
  margin: 0 0 4px;
  font-size: 17px;
  font-weight: 800;
  color: #0f172a;
  text-align: center;
  letter-spacing: -0.02em;
  line-height: 1.2;
}
.pl-doc-sub {
  margin: 0 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  text-align: center;
  line-height: 1.25;
}
.pl-doc-period {
  margin: 0 0 8px;
  font-size: 11.5px;
  color: #475569;
  text-align: center;
}
.pl-doc-note {
  margin: 0 0 10px;
  font-size: 9.5px;
  color: #64748b;
  text-align: center;
  line-height: 1.35;
  padding: 5px 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
}
.pl-sr { font-size: 0.72em; font-weight: 500; color: #64748b; margin-inline-start: 1px; }

.pl-section-title {
  margin: 0 0 6px;
  font-size: 11px;
  font-weight: 800;
  color: #0f172a;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  border-bottom: 2px solid #185FA5;
  padding-bottom: 3px;
}
.pl-exec-summary { page-break-inside: avoid; margin-bottom: 10px; }
.pl-kpi { width: 100%; border-collapse: separate; border-spacing: 5px 0; margin: 0 0 6px; }
.pl-kpi-cell {
  vertical-align: top;
  width: 20%;
  background: linear-gradient(180deg, #f8fafc 0%, #fff 55%);
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 7px 6px 6px;
  text-align: center;
  box-shadow: 0 1px 2px rgba(15,23,42,0.04);
}
.pl-kpi-label {
  font-size: 8.5px;
  font-weight: 700;
  color: #475569;
  line-height: 1.2;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.pl-kpi-val {
  font-size: 13px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  font-family: 'Tajawal', 'Cairo', ui-monospace, monospace;
  color: #0f172a;
  line-height: 1.15;
}
.pl-kpi-sub { font-size: 8px; color: #64748b; margin-top: 3px; line-height: 1.2; }
.pl-formula-foot {
  margin: 0;
  font-size: 8.5px;
  color: #64748b;
  text-align: center;
  font-style: italic;
  line-height: 1.3;
}

.pl-detail-block { margin-top: 4px; }
.pl-detail-block .pl-section-title { margin-top: 2px; }

table.pl-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 9.5px;
  box-shadow: none;
}
table.pl-grid thead th {
  background: #0f172a !important;
  color: #fff !important;
  font-weight: 700;
  font-size: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 5px 6px !important;
  border: 1px solid #0f172a !important;
  vertical-align: bottom;
}
table.pl-grid thead th.pl-col-desc { text-align: start !important; width: 52%; }
table.pl-grid thead th.pl-col-num { text-align: end !important; white-space: nowrap; }
table.pl-grid tbody td {
  padding: 3px 6px !important;
  border: 1px solid #e2e8f0 !important;
  vertical-align: middle;
  line-height: 1.2;
}
table.pl-grid tbody td.pl-col-desc {
  text-align: start !important;
  font-weight: 500;
  color: #1e293b;
}
table.pl-grid tbody td.pl-col-num {
  text-align: end !important;
  font-variant-numeric: tabular-nums;
  font-family: 'Tajawal', 'Cairo', ui-monospace, monospace;
  white-space: nowrap;
}
table.pl-grid tbody tr.pl-gap td {
  height: 3px;
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
}
table.pl-grid tbody tr.pl-row-group td.pl-col-desc {
  font-weight: 800;
  font-size: 9.5px;
  background: #e2e8f0 !important;
  color: #0f172a;
  border-top: 1.5px solid #94a3b8 !important;
}
table.pl-grid tbody tr.pl-row-group td.pl-col-num {
  font-weight: 800;
  background: #e2e8f0 !important;
  border-top: 1.5px solid #94a3b8 !important;
}
table.pl-grid tbody tr.pl-row-detail td.pl-col-desc { background: #fff; }
table.pl-grid tbody tr.pl-row-detail td.pl-col-num { background: #fff; color: #334155; }
table.pl-grid tbody tr.pl-row-detail.pl-depth-1 td.pl-col-desc { padding-inline-start: 14px !important; font-size: 9px; }
table.pl-grid tbody tr.pl-row-detail.pl-depth-2 td.pl-col-desc { padding-inline-start: 22px !important; font-size: 8.8px; }
table.pl-grid tbody tr.pl-row-detail.pl-depth-3 td.pl-col-desc { padding-inline-start: 30px !important; font-size: 8.6px; }
table.pl-grid tbody tr.pl-row-detail.pl-depth-4 td.pl-col-desc { padding-inline-start: 38px !important; font-size: 8.5px; }
table.pl-grid tbody tr.pl-row-summary td {
  font-weight: 800;
  font-size: 10px;
  background: #f1f5f9 !important;
  border-top: 2px double #0f172a !important;
  padding-top: 5px !important;
  padding-bottom: 5px !important;
}
table.pl-grid tbody tr.pl-row-summary.pl-net td.pl-col-num { font-size: 10.5px; }
table.pl-grid tbody tr:nth-child(even):not(.pl-gap):not(.pl-row-group) td { background: #fafafa; }
table.pl-grid tbody tr.pl-row-detail:nth-child(even) td.pl-col-num { background: #fafafa; }

.pl-density-normal table.pl-grid { font-size: 9px; }
.pl-density-normal table.pl-grid tbody td { padding: 2px 5px !important; }
.pl-density-normal .pl-kpi-val { font-size: 12px; }
.pl-density-dense table.pl-grid { font-size: 8px; }
.pl-density-dense table.pl-grid thead th { padding: 4px 4px !important; font-size: 7.5px; }
.pl-density-dense table.pl-grid tbody td { padding: 1px 4px !important; }
.pl-density-dense .pl-kpi-cell { padding: 5px 4px 4px; }
.pl-density-dense .pl-kpi-val { font-size: 11px; }
.pl-density-dense .pl-section-title { font-size: 10px; margin-bottom: 4px; }
.pl-density-dense .pl-doc-title { font-size: 15px; }

.pl-footer-meta {
  margin-top: 8px;
  font-size: 8px;
  color: #94a3b8;
  text-align: center;
  line-height: 1.25;
}

@media print {
  body { padding: 2mm 4mm !important; }
  .pl-root { max-width: 100% !important; }
  .print-header { margin-bottom: 5px !important; padding-bottom: 5px !important; }
  .print-header h1 { font-size: 14px !important; }
  .print-footer { margin-top: 6px !important; padding-top: 4px !important; font-size: 8px !important; }
  .pl-exec-summary, .pl-detail-block { page-break-inside: avoid; }
  table.pl-grid thead { display: table-header-group; }
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`.trim();
}

export function buildPlMonthStatementBody(opts: {
  report: any;
  selectedMonthNumber: number;
  monthLabel: string;
  year: number;
  lang: string;
  t: TFn;
  amountColumnTitle: string;
  /** false = جدول تفاصيل بأقسام وملخص فقط (بدون بنود فرعية) */
  includeLineDetail?: boolean;
}): string {
  const { report, selectedMonthNumber, monthLabel, year, lang, t, amountColumnTitle } = opts;
  const includeLineDetail = opts.includeLineDetail !== false;
  const printRowsAll = buildFlatRows(report, {});
  const printRows = includeLineDetail
    ? printRowsAll
    : printRowsAll.filter((row: any) => row.rowType === 'group' || row.rowType === 'summary');
  const m = selectedMonthNumber;
  const n = printRows.length;
  const zoom = getPlMonthPrintZoom(n);
  const dens = densityClass(n);

  const head = `<thead><tr>
    <th class="pl-col-desc">${esc(t('reportItem'))}</th>
    <th class="pl-col-num">${esc(amountColumnTitle)}</th>
    <th class="pl-col-num">${esc(t('reportSalesShareMonth'))}</th>
  </tr></thead>`;

  const bodyParts: string[] = ['<tbody>'];
  printRows.forEach((row: any, i: number) => {
    if (row.rowType === 'group' && i > 0) {
      bodyParts.push('<tr class="pl-gap"><td colspan="3"></td></tr>');
    }

    const label = esc(displayLabel(row, lang));
    const amt = amountText(getContextAmount(row, m));
    const pctM = percentText(getContextPercent(row, m));

    let trClass = '';
    if (row.rowType === 'summary') {
      trClass = 'pl-row-summary';
      if (row.key === 'netProfit') trClass += ' pl-net';
    } else if (row.rowType === 'group') {
      trClass = 'pl-row-group';
    } else {
      trClass = `pl-row-detail pl-depth-${Math.min(Number(row.depth) || 0, 4)}`;
    }

    const summaryAmt =
      row.rowType === 'summary' && (row.key === 'netProfit' || row.key === 'grossProfit')
        ? Number(getContextAmount(row, m) || 0)
        : null;
    const amtAttr =
      summaryAmt != null && Number.isFinite(summaryAmt)
        ? ` style="color:${summaryAmt < 0 ? '#b91c1c' : '#15803d'}"`
        : '';

    bodyParts.push(
      `<tr class="${trClass}">` +
        `<td class="pl-col-desc">${label}</td>` +
        `<td class="pl-col-num"${amtAttr}>${esc(amt)}</td>` +
        `<td class="pl-col-num">${esc(pctM)}</td>` +
        `</tr>`,
    );
  });
  bodyParts.push('</tbody>');

  const title = esc(t('reportIncomeStatementTitle'));
  const period = esc(periodLine(t, monthLabel, year));
  const note = esc(t('reportPlCurrencyNoteShort'));
  const meta = esc(t('reportPlPreparedBy'));
  const summaryHtml = buildExecutiveSummaryHtml(report, m, lang, t);

  return (
    `<div class="pl-root" style="zoom:${zoom}">` +
    `<div class="pl-doc ${dens}">` +
    `<h2 class="pl-doc-title">${title}</h2>` +
    `<div class="pl-doc-sub">${esc(t('reportGeneral'))}</div>` +
    `<p class="pl-doc-period">${period}</p>` +
    `<p class="pl-doc-note">${note}</p>` +
    summaryHtml +
    `<section class="pl-detail-block">` +
    `<h3 class="pl-section-title">${esc(includeLineDetail ? t('reportPlDetailSectionTitle') : t('reportPlDetailSectionTitleSummary'))}</h3>` +
    `<table class="pl-grid">${head}${bodyParts.join('')}</table>` +
    `</section>` +
    `<p class="pl-footer-meta">${meta} · ${esc(t('reportPlSinglePageLayout'))}</p>` +
    `</div></div>`
  );
}

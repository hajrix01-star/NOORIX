/**
 * HTML + CSS لتقرير الكاش — طباعة A4 عمودي (openPrintWindow).
 */

import { buildPrintTableHtml } from '../../../utils/printTableHtml';

function esc(v: unknown) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type CashReportVaultRow = {
  vaultName: string;
  inflow: string;
  outflow: string;
  remainder: string;
};

export type CashReportLabels = {
  reportTitle: string;
  subtitle: string;
  periodLine: string;
  scopeNote: string;
  vaultSectionTitle: string;
  colVault: string;
  colIn: string;
  colOut: string;
  colRemain: string;
  totalsTitle: string;
  salesCashOnHandTitle: string;
  salesCashOnHandHint: string;
  summariesCountLabel: string;
  noCashVaults: string;
};

export const INVOICES_CASH_REPORT_PRINT_EXTRA_CSS = `
.cash-report-wrap { max-width: 720px; margin: 0 auto; }
.cash-report-h2 {
  font-size: 22px; font-weight: 800; color: #0f172a; margin: 0 0 6px; text-align: center;
}
.cash-report-sub { text-align: center; font-size: 13px; color: #475569; margin: 0 0 4px; }
.cash-report-scope {
  text-align: center; font-size: 11px; color: #64748b; margin: 0 0 20px; padding: 8px 12px;
  background: #f1f5f9; border-radius: 8px; border: 1px solid #e2e8f0;
}
.cash-kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 22px;
}
.cash-kpi {
  border: 1px solid #cbd5e1; border-radius: 10px; padding: 14px 12px; text-align: center;
  background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
}
.cash-kpi .lbl { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.02em; margin-bottom: 6px; }
.cash-kpi .num { font-size: 20px; font-weight: 800; color: #0f172a; direction: ltr; unicode-bidi: plaintext; }
.cash-kpi.in .num { color: #15803d; }
.cash-kpi.out .num { color: #b45309; }
.cash-kpi.rem .num { color: #185FA5; }
.cash-section-title {
  font-size: 14px; font-weight: 800; color: #334155; margin: 18px 0 10px; padding-bottom: 6px; border-bottom: 2px solid #185FA5;
}
.cash-on-hand-card {
  margin-top: 18px; padding: 16px 18px; border-radius: 12px; border: 1px solid #93c5fd;
  background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%);
}
.cash-on-hand-card .t { font-size: 13px; font-weight: 800; color: #1e40af; margin: 0 0 6px; }
.cash-on-hand-card .amt { font-size: 24px; font-weight: 800; color: #0f172a; direction: ltr; unicode-bidi: plaintext; margin: 0; }
.cash-on-hand-card .hint { font-size: 11px; color: #64748b; margin: 8px 0 0; line-height: 1.5; }
.cash-table-wrap { overflow: hidden; border-radius: 10px; border: 1px solid #e2e8f0; }
.cash-table-wrap table { margin: 0; }
.cash-table-wrap th { background: #185FA5; }
.cash-table-strong { font-weight: 800; }
.cash-table-number { direction: ltr; unicode-bidi: plaintext; }
.cash-empty { text-align: center; padding: 20px; color: #64748b; font-size: 13px; border: 1px dashed #cbd5e1; border-radius: 10px; }
@media print {
  .cash-kpi .num { font-size: 18px; }
  .cash-on-hand-card .amt { font-size: 20px; }
}
`.trim();

export function buildInvoicesCashReportBody(
  labels: CashReportLabels,
  vaultRows: CashReportVaultRow[],
  totals: { inflow: string; outflow: string; remainder: string },
  salesCashOnHandSum: string,
  salesSummaryCount: number,
): string {
  const kpi = (cls: string, lbl: string, num: string) =>
    `<div class="cash-kpi ${cls}"><div class="lbl">${esc(lbl)}</div><div class="num">${esc(num)} SR</div></div>`;

  const vaultTable =
    vaultRows.length === 0
      ? `<div class="cash-empty">${esc(labels.noCashVaults)}</div>`
      : buildPrintTableHtml({
          columns: [
            { key: 'vaultName', header: labels.colVault },
            { key: 'inflow', header: labels.colIn, align: 'right', cellClassName: 'cash-table-number' },
            { key: 'outflow', header: labels.colOut, align: 'right', cellClassName: 'cash-table-number' },
            { key: 'remainder', header: labels.colRemain, align: 'right', cellClassName: 'cash-table-number cash-table-strong' },
          ],
          rows: vaultRows,
          wrapperClassName: 'cash-table-wrap',
          footerRows: [[
            { value: labels.totalsTitle, className: 'cash-table-strong' },
            { value: totals.inflow, align: 'right', className: 'cash-table-number cash-table-strong' },
            { value: totals.outflow, align: 'right', className: 'cash-table-number cash-table-strong' },
            { value: totals.remainder, align: 'right', className: 'cash-table-number cash-table-strong' },
          ]],
        });

  return `
<div class="cash-report-wrap">
  <h2 class="cash-report-h2">${esc(labels.reportTitle)}</h2>
  <p class="cash-report-sub">${esc(labels.subtitle)}</p>
  <p class="cash-report-sub">${esc(labels.periodLine)}</p>
  <p class="cash-report-scope">${esc(labels.scopeNote)}</p>
  <div class="cash-kpi-grid">
    ${kpi('in', labels.colIn, totals.inflow)}
    ${kpi('out', labels.colOut, totals.outflow)}
    ${kpi('rem', labels.colRemain, totals.remainder)}
  </div>
  <div class="cash-section-title">${esc(labels.vaultSectionTitle)}</div>
  ${vaultTable}
  <div class="cash-on-hand-card">
    <p class="t">${esc(labels.salesCashOnHandTitle)}</p>
    <p class="amt">${esc(salesCashOnHandSum)} SR</p>
    <p class="hint">${esc(labels.salesCashOnHandHint)} — ${esc(labels.summariesCountLabel)}: ${esc(String(salesSummaryCount))}</p>
  </div>
</div>
`.trim();
}

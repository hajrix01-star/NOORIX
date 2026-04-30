/**
 * طباعة شهرية — تخطيط قائمة دخل (P&L) بأسلوب تقارير محاسبية شائعة:
 * فترة واضحة، أعمدة مبالغ/نِسب، فصل بصري بين أقسام الإيراد والتكلفة والمصاريف ونتائج الربحية.
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

/** أنماط وثيقة قائمة الدخل — تكمّل printUtils الأساسية */
export function plMonthStatementPrintCss(): string {
  return `
.pl-doc { max-width: 820px; margin: 0 auto; }
.pl-doc-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 800;
  color: #0f172a;
  text-align: center;
  letter-spacing: -0.02em;
}
.pl-doc-sub {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  text-align: center;
}
.pl-doc-period {
  margin: 0 0 14px;
  font-size: 13px;
  color: #475569;
  text-align: center;
}
.pl-doc-note {
  margin: 0 0 18px;
  font-size: 11px;
  color: #64748b;
  text-align: center;
  line-height: 1.5;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
table.pl-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  box-shadow: 0 1px 3px rgba(15,23,42,0.06);
}
table.pl-grid thead th {
  background: #0f172a !important;
  color: #fff !important;
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 10px 10px !important;
  border: 1px solid #0f172a !important;
  vertical-align: bottom;
}
table.pl-grid thead th.pl-col-desc { text-align: start !important; width: 42%; }
table.pl-grid thead th.pl-col-num { text-align: end !important; white-space: nowrap; }
table.pl-grid tbody td {
  padding: 7px 10px !important;
  border: 1px solid #e2e8f0 !important;
  vertical-align: middle;
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
  height: 10px;
  padding: 0 !important;
  border: none !important;
  background: transparent !important;
}
table.pl-grid tbody tr.pl-row-group td.pl-col-desc {
  font-weight: 800;
  font-size: 12.5px;
  background: #e2e8f0 !important;
  color: #0f172a;
  border-top: 2px solid #94a3b8 !important;
}
table.pl-grid tbody tr.pl-row-group td.pl-col-num {
  font-weight: 800;
  background: #e2e8f0 !important;
  border-top: 2px solid #94a3b8 !important;
}
table.pl-grid tbody tr.pl-row-detail td.pl-col-desc { background: #fff; }
table.pl-grid tbody tr.pl-row-detail td.pl-col-num { background: #fff; color: #334155; }
table.pl-grid tbody tr.pl-row-detail.pl-depth-1 td.pl-col-desc { padding-inline-start: 22px !important; font-size: 11.5px; }
table.pl-grid tbody tr.pl-row-detail.pl-depth-2 td.pl-col-desc { padding-inline-start: 34px !important; font-size: 11.5px; }
table.pl-grid tbody tr.pl-row-detail.pl-depth-3 td.pl-col-desc { padding-inline-start: 46px !important; font-size: 11.5px; }
table.pl-grid tbody tr.pl-row-detail.pl-depth-4 td.pl-col-desc { padding-inline-start: 58px !important; font-size: 11.5px; }
table.pl-grid tbody tr.pl-row-summary td {
  font-weight: 800;
  font-size: 13px;
  background: #f1f5f9 !important;
  border-top: 3px double #0f172a !important;
  padding-top: 10px !important;
  padding-bottom: 10px !important;
}
table.pl-grid tbody tr.pl-row-summary.pl-net td.pl-col-num { font-size: 14px; }
table.pl-grid tbody tr:nth-child(even):not(.pl-gap):not(.pl-row-group) td { background: #fafafa; }
table.pl-grid tbody tr.pl-row-detail:nth-child(even) td.pl-col-num { background: #fafafa; }
.pl-footer-meta {
  margin-top: 20px;
  font-size: 10px;
  color: #94a3b8;
  text-align: center;
}
`.trim();
}

type TFn = (key: string) => string;

export function buildPlMonthStatementBody(opts: {
  report: any;
  selectedMonthNumber: number;
  monthLabel: string;
  year: number;
  lang: string;
  t: TFn;
  amountColumnTitle: string;
}): string {
  const { report, selectedMonthNumber, monthLabel, year, lang, t, amountColumnTitle } = opts;
  const printRows = buildFlatRows(report, {});
  const m = selectedMonthNumber;

  const head = `<thead><tr>
    <th class="pl-col-desc">${esc(t('reportItem'))}</th>
    <th class="pl-col-num">${esc(amountColumnTitle)}</th>
    <th class="pl-col-num">${esc(t('reportSalesShareMonth'))}</th>
    <th class="pl-col-num">${esc(t('reportYtdShort'))}</th>
    <th class="pl-col-num">${esc(t('reportSalesShareYear'))}</th>
  </tr></thead>`;

  const bodyParts: string[] = ['<tbody>'];
  printRows.forEach((row: any, i: number) => {
    if (row.rowType === 'group' && i > 0) {
      bodyParts.push('<tr class="pl-gap"><td colspan="5"></td></tr>');
    }

    const label = esc(displayLabel(row, lang));
    const amt = amountText(getContextAmount(row, m));
    const pctM = percentText(getContextPercent(row, m));
    const ytd = amountText(row.total);
    const pctY = percentText(row.percentOfSalesYear);

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
        `<td class="pl-col-num">${esc(ytd)}</td>` +
        `<td class="pl-col-num">${esc(pctY)}</td>` +
        `</tr>`,
    );
  });
  bodyParts.push('</tbody>');

  const title = esc(t('reportIncomeStatementTitle'));
  const period = esc(periodLine(t, monthLabel, year));
  const note = esc(t('reportPlCurrencyNote'));
  const meta = esc(t('reportPlPreparedBy'));

  return (
    `<div class="pl-doc">` +
    `<h2 class="pl-doc-title">${title}</h2>` +
    `<div class="pl-doc-sub">${esc(t('reportGeneral'))}</div>` +
    `<p class="pl-doc-period">${period}</p>` +
    `<p class="pl-doc-note">${note}</p>` +
    `<table class="pl-grid">${head}${bodyParts.join('')}</table>` +
    `<p class="pl-footer-meta">${meta}</p>` +
    `</div>`
  );
}

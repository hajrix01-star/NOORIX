import Decimal from 'decimal.js';
import { exportToExcel } from '../../../utils/exportUtils';
import { fmt } from '../../../utils/format';
import { openPrintWindow } from '../../../utils/printUtils';
import type { CostAppsPlResult } from '../costAccountingAppsModel';
import { parseMoneyInput, type FixedLine } from './costAccountingAppsScreenUtils';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

function fmt2(d: Decimal): string {
  return fmt(d.toNumber(), 2);
}

export function buildCostAppsPrintBody(params: {
  t: TranslateFn;
  appSalesRowLabel: string;
  withAppsScenarioLabel: string;
  plWith: CostAppsPlResult;
  plWithout: CostAppsPlResult;
  fixedLines: FixedLine[];
  salaryStr: string;
  expensesMonthlyTotal: Decimal;
  expensesAnnualTotal: Decimal;
}): string {
  const { t, appSalesRowLabel, withAppsScenarioLabel, plWith, plWithout, fixedLines, salaryStr } = params;
  const rows = [
    ['', withAppsScenarioLabel, t('reportCostAppsScenarioNoApps')],
    [appSalesRowLabel, fmt2(plWith.grossApp), fmt2(plWithout.grossApp)],
    [t('reportCostAppsPlLocalSales'), fmt2(plWith.grossLocal), fmt2(plWithout.grossLocal)],
    [t('reportCostAppsGrossTotal'), fmt2(plWith.grossTotal), fmt2(plWithout.grossTotal)],
    [t('reportCostAppsNetSales'), fmt2(plWith.netSales), fmt2(plWithout.netSales)],
    [t('reportCostAppsVatExtracted'), fmt2(plWith.vatAmount), fmt2(plWithout.vatAmount)],
    [t('reportCostAppsCommission'), fmt2(plWith.commission), fmt2(plWithout.commission)],
    [t('reportCostAppsCogsLocal'), fmt2(plWith.cogsLocal), fmt2(plWithout.cogsLocal)],
    [t('reportCostAppsCogsApp'), fmt2(plWith.cogsApp), fmt2(plWithout.cogsApp)],
    [t('reportCostAppsCogsTotal'), fmt2(plWith.cogsTotal), fmt2(plWithout.cogsTotal)],
    [
      t('reportCostAppsExpensesTotalRow'),
      fmt2(plWith.fixedTotal.plus(plWith.salaryTotal)),
      fmt2(plWithout.fixedTotal.plus(plWithout.salaryTotal)),
    ],
    [t('reportCostAppsNetProfit'), fmt2(plWith.netProfit), fmt2(plWithout.netProfit)],
  ];

  return `
      <table>
        <thead><tr><th>${t('reportItem')}</th><th>${withAppsScenarioLabel}</th><th>${t('reportCostAppsScenarioNoApps')}</th></tr></thead>
        <tbody>
          ${rows
            .slice(1)
            .map(
              (r) =>
                `<tr><td>${String(r[0]).replace(/</g, '&lt;')}</td><td style="text-align:right">${r[1]}</td><td style="text-align:right">${r[2]}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>
      <h3 style="margin:12px 0 6px;font-size:13px;">${t('reportCostAppsFixedLines')}</h3>
      <table>
        <thead><tr><th>${t('reportCostAppsLineLabel')}</th><th style="text-align:right">${t('reportCostAppsLineMonthlyAmount')}</th><th style="text-align:right">${t('reportCostAppsLineAnnualAmount')}</th></tr></thead>
        <tbody>
          <tr>
            <td class="border border-noorix-border px-2 py-2">${String(t('reportCostAppsPayrollLineLabel')).replace(/</g, '&lt;')}</td>
            <td style="text-align:right">${fmt(parseMoneyInput(salaryStr).toNumber(), 2)}</td>
            <td style="text-align:right">${fmt(parseMoneyInput(salaryStr).mul(12).toNumber(), 2)}</td>
          </tr>
          ${fixedLines
            .map((l) => {
              const m = parseMoneyInput(l.amount);
              const a = m.mul(12);
              return `<tr><td>${String(l.label || '—').replace(/</g, '&lt;')}</td><td style="text-align:right">${fmt(m.toNumber(), 2)}</td><td style="text-align:right">${fmt(a.toNumber(), 2)}</td></tr>`;
            })
            .join('')}
          <tr><td><strong>${t('reportTotalAmount')}</strong></td><td style="text-align:right"><strong>${fmt2(params.expensesMonthlyTotal)}</strong></td><td style="text-align:right"><strong>${fmt2(params.expensesAnnualTotal)}</strong></td></tr>
        </tbody>
      </table>
    `;
}

export function printCostAppsReport(params: {
  t: TranslateFn;
  companyName: string;
  appSalesRowLabel: string;
  withAppsScenarioLabel: string;
  plWith: CostAppsPlResult;
  plWithout: CostAppsPlResult;
  fixedLines: FixedLine[];
  salaryStr: string;
  expensesMonthlyTotal: Decimal;
  expensesAnnualTotal: Decimal;
}) {
  openPrintWindow({
    title: params.t('reportCostAppsTitle'),
    companyName: params.companyName || params.t('reports'),
    subtitle: params.t('reportCostAppsTitle'),
    landscape: false,
    showPageCounter: false,
    pageMarginMm: 10,
    extraCss: `
        table { font-size: 11px; }
        th, td { padding: 4px 6px; }
        body { font-size: 11px; }
        @page { margin: 10mm; }
      `,
    body: buildCostAppsPrintBody(params),
  });
}

export async function exportCostAppsReportExcel(params: {
  t: TranslateFn;
  companyName: string;
  appSalesRowLabel: string;
  withAppsScenarioLabel: string;
  plWith: CostAppsPlResult;
  plWithout: CostAppsPlResult;
}) {
  const { t, appSalesRowLabel, withAppsScenarioLabel, plWith, plWithout } = params;
  const rows = [
    { item: appSalesRowLabel, withApps: plWith.grossApp.toNumber(), noApps: plWithout.grossApp.toNumber() },
    { item: t('reportCostAppsPlLocalSales'), withApps: plWith.grossLocal.toNumber(), noApps: plWithout.grossLocal.toNumber() },
    { item: t('reportCostAppsGrossTotal'), withApps: plWith.grossTotal.toNumber(), noApps: plWithout.grossTotal.toNumber() },
    { item: t('reportCostAppsNetSales'), withApps: plWith.netSales.toNumber(), noApps: plWithout.netSales.toNumber() },
    { item: t('reportCostAppsCommission'), withApps: plWith.commission.toNumber(), noApps: plWithout.commission.toNumber() },
    { item: t('reportCostAppsCogsLocal'), withApps: plWith.cogsLocal.toNumber(), noApps: plWithout.cogsLocal.toNumber() },
    { item: t('reportCostAppsCogsApp'), withApps: plWith.cogsApp.toNumber(), noApps: plWithout.cogsApp.toNumber() },
    { item: t('reportCostAppsCogsTotal'), withApps: plWith.cogsTotal.toNumber(), noApps: plWithout.cogsTotal.toNumber() },
    {
      item: t('reportCostAppsExpensesTotalRow'),
      withApps: plWith.fixedTotal.plus(plWith.salaryTotal).toNumber(),
      noApps: plWithout.fixedTotal.plus(plWithout.salaryTotal).toNumber(),
    },
    { item: t('reportCostAppsNetProfit'), withApps: plWith.netProfit.toNumber(), noApps: plWithout.netProfit.toNumber() },
  ];

  await exportToExcel({
    data: rows,
    filename: 'cost-apps-calculator.xlsx',
    title: t('reportCostAppsTitle'),
    companyName: params.companyName || '',
    sheetName: 'P&L',
    columns: [
      { key: 'item', label: t('reportItem') },
      { key: 'withApps', label: withAppsScenarioLabel },
      { key: 'noApps', label: t('reportCostAppsScenarioNoApps') },
    ],
    money2ColumnKeys: ['withApps', 'noApps'],
  });
}

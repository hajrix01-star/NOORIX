import Decimal from 'decimal.js';
import { exportToExcel } from '../../../utils/exportUtils';
import { fmt } from '../../../utils/format';
import { buildPrintHtmlTable } from '../../../utils/printTableHtml';
import { buildPrintDocumentHtml } from '../../../utils/printUtils';
import type { CostAppsPlResult } from '../costAccountingAppsModel';
import { parseMoneyInput, type FixedLine } from './costAccountingAppsScreenUtils';

type TranslateFn = (key: string, vars?: Record<string, unknown>) => string;

function fmt2(d: Decimal): string {
  return fmt(d.toNumber());
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
  const scenarioRows: Array<[string, string, string]> = [
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
  const fixedLineRows: Array<[string, string, string]> = [
    [
      t('reportCostAppsPayrollLineLabel'),
      fmt(parseMoneyInput(salaryStr).toNumber()),
      fmt(parseMoneyInput(salaryStr).mul(12).toNumber()),
    ],
    ...fixedLines.map((line): [string, string, string] => {
      const monthly = parseMoneyInput(line.amount);
      return [line.label || '-', fmt(monthly.toNumber()), fmt(monthly.mul(12).toNumber())];
    }),
  ];

  return [
    buildPrintHtmlTable({
      wrapperClassName: null,
      headerRows: [{
        cells: [
          { value: t('reportItem') },
          { value: withAppsScenarioLabel, align: 'end' },
          { value: t('reportCostAppsScenarioNoApps'), align: 'end' },
        ],
      }],
      bodyRows: scenarioRows.map((row) => ({
        cells: [
          { value: row[0] },
          { value: row[1], align: 'end' },
          { value: row[2], align: 'end' },
        ],
      })),
    }),
    '<h3 style="margin:12px 0 6px;font-size:13px;">' + t('reportCostAppsFixedLines') + '</h3>',
    buildPrintHtmlTable({
      wrapperClassName: null,
      headerRows: [{
        cells: [
          { value: t('reportCostAppsLineLabel') },
          { value: t('reportCostAppsLineMonthlyAmount'), align: 'end' },
          { value: t('reportCostAppsLineAnnualAmount'), align: 'end' },
        ],
      }],
      bodyRows: fixedLineRows.map((row) => ({
        cells: [
          { value: row[0] },
          { value: row[1], align: 'end' },
          { value: row[2], align: 'end' },
        ],
      })),
      footerRows: [{
        cells: [
          { value: t('reportTotalAmount'), style: 'font-weight:700' },
          { value: fmt2(params.expensesMonthlyTotal), align: 'end', style: 'font-weight:700' },
          { value: fmt2(params.expensesAnnualTotal), align: 'end', style: 'font-weight:700' },
        ],
      }],
    }),
  ].join('\n');
}

export function buildCostAppsReportPrintHtml(params: {
  t: TranslateFn;
  companyName: string;
  logoUrl?: string;
  appSalesRowLabel: string;
  withAppsScenarioLabel: string;
  plWith: CostAppsPlResult;
  plWithout: CostAppsPlResult;
  fixedLines: FixedLine[];
  salaryStr: string;
  expensesMonthlyTotal: Decimal;
  expensesAnnualTotal: Decimal;
}): string {
  return buildPrintDocumentHtml({
    title: params.t('reportCostAppsTitle'),
    companyName: params.companyName || params.t('reports'),
    logoUrl: params.logoUrl || '',
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
  logoUrl?: string;
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
    logoUrl: params.logoUrl || '',
    sheetName: 'P&L',
    columns: [
      { key: 'item', label: t('reportItem') },
      { key: 'withApps', label: withAppsScenarioLabel },
      { key: 'noApps', label: t('reportCostAppsScenarioNoApps') },
    ],
    money2ColumnKeys: ['withApps', 'noApps'],
  });
}

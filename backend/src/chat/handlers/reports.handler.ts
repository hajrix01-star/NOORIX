import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler } from './types';
import { matches } from './utils';
import { formatReportMoneyInteger } from '../../common/utils/report-display-format.util';

const REPORT_MATCH_TERMS = [
  '\u0631\u0628\u062d',
  '\u062e\u0633\u0627\u0631\u0629',
  '\u062a\u0642\u0631\u064a\u0631',
  '\u0645\u0644\u062e\u0635',
  '\u0627\u0644\u0631\u0628\u062d',
  '\u0648\u0627\u0644\u062e\u0633\u0627\u0631\u0629',
  'profit',
  'loss',
  'report',
] as const;

function fmtSar(value: string): string {
  return formatReportMoneyInteger(value) + ' SR';
}

function fmtSarEn(value: string): string {
  return formatReportMoneyInteger(value) + ' SAR';
}

export const reportsHandler: ChatHandler = {
  priority: 13,
  intent: 'reports',
  matchesIntent: (intent, can) => intent === 'reports' && can(PERMISSIONS.REPORTS_READ),
  canHandle: (q, can) => matches(q, [...REPORT_MATCH_TERMS]) && can(PERMISSIONS.REPORTS_READ),
  process: async (ctx) => {
    const { companyId, period, year } = ctx;
    const { reportsService } = ctx;

    if (period) {
      const [salesTotal, purchasesTotal, expensesTotal] = await Promise.all([
        ctx.chatFinancialMetrics.sumRevenue(companyId, period.start, period.end),
        ctx.chatFinancialMetrics.sumPurchases(companyId, period.start, period.end),
        ctx.chatFinancialMetrics.sumOperatingExpenses(companyId, period.start, period.end),
      ]);
      const grossProfit = salesTotal.minus(purchasesTotal);
      const netProfit = grossProfit.minus(expensesTotal);
      const fmtDecimal = (value: { toString(): string }) => fmtSar(value.toString());
      const fmtDecimalEn = (value: { toString(): string }) => fmtSarEn(value.toString());

      return {
        answerAr: [
          '## \u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u0631\u0628\u062d \u0648\u0627\u0644\u062e\u0633\u0627\u0631\u0629 - ' + period.labelAr,
          '',
          '\u0627\u0644\u0628\u0646\u062f\t\u0627\u0644\u0645\u0628\u0644\u063a',
          '\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a\t' + fmtDecimal(salesTotal),
          '\u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a\t' + fmtDecimal(purchasesTotal),
          '\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a\t' + fmtDecimal(expensesTotal),
          '\u0627\u0644\u0631\u0628\u062d \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\t' + fmtDecimal(grossProfit),
          '\u0627\u0644\u0631\u0628\u062d \u0627\u0644\u0635\u0627\u0641\u064a\t' + fmtDecimal(netProfit),
        ].join('\n'),
        answerEn: [
          '## Profit and loss report - ' + period.labelEn,
          '',
          'Item\tAmount',
          'Sales\t' + fmtDecimalEn(salesTotal),
          'Purchases\t' + fmtDecimalEn(purchasesTotal),
          'Expenses\t' + fmtDecimalEn(expensesTotal),
          'Gross profit\t' + fmtDecimalEn(grossProfit),
          'Net profit\t' + fmtDecimalEn(netProfit),
        ].join('\n'),
      };
    }

    const report = await reportsService.getGeneralProfitLoss(companyId, year);
    const sales = report?.cards?.sales ?? '0';
    const purchases = report?.cards?.purchases ?? '0';
    const expenses = report?.cards?.expenses ?? '0';
    const gross = report?.cards?.grossProfit ?? '0';
    const net = report?.cards?.netProfit ?? '0';
    return {
      answerAr: [
        '## \u0645\u0644\u062e\u0635 \u0627\u0644\u0631\u0628\u062d \u0648\u0627\u0644\u062e\u0633\u0627\u0631\u0629 - ' + year,
        '',
        '\u0627\u0644\u0628\u0646\u062f\t\u0627\u0644\u0645\u0628\u0644\u063a',
        '\u0627\u0644\u0645\u0628\u064a\u0639\u0627\u062a\t' + fmtSar(sales),
        '\u0627\u0644\u0645\u0634\u062a\u0631\u064a\u0627\u062a\t' + fmtSar(purchases),
        '\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a\t' + fmtSar(expenses),
        '\u0627\u0644\u0631\u0628\u062d \u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a\t' + fmtSar(gross),
        '\u0627\u0644\u0631\u0628\u062d \u0627\u0644\u0635\u0627\u0641\u064a\t' + fmtSar(net),
      ].join('\n'),
      answerEn: [
        '## P&L summary - ' + year,
        '',
        'Item\tAmount',
        'Sales\t' + fmtSarEn(sales),
        'Purchases\t' + fmtSarEn(purchases),
        'Expenses\t' + fmtSarEn(expenses),
        'Gross profit\t' + fmtSarEn(gross),
        'Net profit\t' + fmtSarEn(net),
      ].join('\n'),
    };
  },
};

import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';

export const reportsHandler: ChatHandler = {
  priority: 13,
  intent: 'reports',
  matchesIntent: (intent, can) => intent === 'reports' && can(PERMISSIONS.REPORTS_READ),
  canHandle: (q, can) =>
    matches(q, ['ربح', 'خسارة', 'تقرير', 'profit', 'loss', 'report', 'ملخص', 'الربح', 'والخسارة']) &&
    can(PERMISSIONS.REPORTS_READ),
  process: async (ctx) => {
    const { companyId, year } = ctx;
    const { reportsService } = ctx;
    const report = await reportsService.getGeneralProfitLoss(companyId, year);
    const sales = report?.cards?.sales ?? '0';
    const purchases = report?.cards?.purchases ?? '0';
    const expenses = report?.cards?.expenses ?? '0';
    const gross = report?.cards?.grossProfit ?? '0';
    const net = report?.cards?.netProfit ?? '0';
    const fmt = (v: string) => `${Number(v).toLocaleString('en')} SR`;
    const fmtEn = (v: string) => `${Number(v).toLocaleString('en')} SAR`;
    return {
      answerAr: [
        `## ملخص الربح والخسارة — ${year}`,
        '',
        'البند\tالمبلغ',
        `المبيعات\t${fmt(sales)}`,
        `المشتريات\t${fmt(purchases)}`,
        `المصروفات\t${fmt(expenses)}`,
        `الربح الإجمالي\t${fmt(gross)}`,
        `الربح الصافي\t${fmt(net)}`,
      ].join('\n'),
      answerEn: [
        `## P&L summary — ${year}`,
        '',
        'Item\tAmount',
        `Sales\t${fmtEn(sales)}`,
        `Purchases\t${fmtEn(purchases)}`,
        `Expenses\t${fmtEn(expenses)}`,
        `Gross profit\t${fmtEn(gross)}`,
        `Net profit\t${fmtEn(net)}`,
      ].join('\n'),
    };
  },
};

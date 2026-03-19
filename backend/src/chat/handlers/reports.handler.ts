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
    return {
      answerAr: `ملخص الربح والخسارة ${year}:\n• المبيعات: ${Number(sales).toLocaleString('en')} ﷼\n• المشتريات: ${Number(purchases).toLocaleString('en')} ﷼\n• المصروفات: ${Number(expenses).toLocaleString('en')} ﷼\n• الربح الإجمالي: ${Number(gross).toLocaleString('en')} ﷼\n• الربح الصافي: ${Number(net).toLocaleString('en')} ﷼`,
      answerEn: `P&L Summary ${year}:\n• Sales: ${Number(sales).toLocaleString('en')} SAR\n• Purchases: ${Number(purchases).toLocaleString('en')} SAR\n• Expenses: ${Number(expenses).toLocaleString('en')} SAR\n• Gross Profit: ${Number(gross).toLocaleString('en')} SAR\n• Net Profit: ${Number(net).toLocaleString('en')} SAR`,
    };
  },
};

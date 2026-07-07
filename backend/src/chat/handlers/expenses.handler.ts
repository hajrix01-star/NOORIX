import { formatReportMoneyInteger } from '../../common/utils/report-display-format.util';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';
import { classifyDashboardInsightsQuery } from './dashboard-insights.handler';

export const expensesHandler: ChatHandler = {
  priority: 12,
  intent: 'expenses',
  matchesIntent: (intent, can) =>
    intent === 'expenses' && (can(PERMISSIONS.VIEW_EXPENSES) || can(PERMISSIONS.EXPENSES_READ)),
  canHandle: (q, can) =>
    classifyDashboardInsightsQuery(q) == null &&
    matches(q, ['مصروفات', 'مصاريف', 'المصروفات', 'expenses', 'كم صرفنا', 'إجمالي المصروفات']) &&
    (can(PERMISSIONS.VIEW_EXPENSES) || can(PERMISSIONS.EXPENSES_READ)),
  process: async (ctx) => {
    const { companyId, period } = ctx;
    if (period) {
      const total = await ctx.chatFinancialMetrics.sumOperatingExpenses(companyId, period.start, period.end);
      const amt = `${formatReportMoneyInteger(total)} SR`;
      const amtEn = `${formatReportMoneyInteger(total)} SAR`;
      return {
        answerAr: ['## مصروفات الفترة', '', 'البند\tالمبلغ', `${period.labelAr}\t${amt}`].join('\n'),
        answerEn: ['## Expenses for the period', '', 'Item\tAmount', `${period.labelEn}\t${amtEn}`].join('\n'),
      };
    }

    const total = await ctx.chatFinancialMetrics.annualExpenses(companyId, ctx.year);
    const amt = `${formatReportMoneyInteger(total)} SR`;
    const amtEn = `${formatReportMoneyInteger(total)} SAR`;
    return {
      answerAr: ['## مصروفات السنة', '', 'البند\tالمبلغ', `إجمالي المصروفات (${ctx.year})\t${amt}`].join('\n'),
      answerEn: ['## Annual expenses', '', 'Item\tAmount', `Total expenses (${ctx.year})\t${amtEn}`].join('\n'),
    };
  },
};

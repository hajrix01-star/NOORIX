import { formatReportMoneyInteger } from '../../common/utils/report-display-format.util';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';
import { classifyDashboardInsightsQuery } from './dashboard-insights.handler';

export const purchasesHandler: ChatHandler = {
  priority: 11,
  intent: 'purchases',
  matchesIntent: (intent, can) => intent === 'purchases' && can(PERMISSIONS.VIEW_INVOICES),
  canHandle: (q, can) =>
    classifyDashboardInsightsQuery(q) == null &&
    matches(q, ['مشتريات', 'المشتريات', 'purchases', 'كم اشترينا', 'إجمالي المشتريات']) &&
    can(PERMISSIONS.VIEW_INVOICES),
  process: async (ctx) => {
    const { companyId, period } = ctx;
    if (period) {
      const total = await ctx.chatFinancialMetrics.sumPurchases(companyId, period.start, period.end);
      const amt = `${formatReportMoneyInteger(total)} SR`;
      const amtEn = `${formatReportMoneyInteger(total)} SAR`;
      return {
        answerAr: ['## مشتريات الفترة', '', 'البند\tالمبلغ', `${period.labelAr}\t${amt}`].join('\n'),
        answerEn: ['## Purchases for the period', '', 'Item\tAmount', `${period.labelEn}\t${amtEn}`].join('\n'),
      };
    }

    const total = await ctx.chatFinancialMetrics.annualPurchases(companyId, ctx.year);
    const amt = `${formatReportMoneyInteger(total)} SR`;
    const amtEn = `${formatReportMoneyInteger(total)} SAR`;
    return {
      answerAr: ['## مشتريات السنة', '', 'البند\tالمبلغ', `إجمالي المشتريات (${ctx.year})\t${amt}`].join('\n'),
      answerEn: ['## Annual purchases', '', 'Item\tAmount', `Total purchases (${ctx.year})\t${amtEn}`].join('\n'),
    };
  },
};

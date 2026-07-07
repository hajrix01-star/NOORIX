import { formatReportMoneyInteger } from '../../common/utils/report-display-format.util';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches, parsePeriod } from './utils';

export const salesHandler: ChatHandler = {
  priority: 10,
  intent: 'sales',
  matchesIntent: (intent, can) => intent === 'sales' && (can(PERMISSIONS.VIEW_SALES) || can(PERMISSIONS.SALES_READ)),
  canHandle: (q, can) => {
    if (!(can(PERMISSIONS.VIEW_SALES) || can(PERMISSIONS.SALES_READ))) return false;
    /* أسئلة النسب المالية تُعالج في financeRatiosHandler */
    if (matches(q, ['نسبة']) && matches(q, ['مبيعات']) && (matches(q, ['مشتريات']) || matches(q, ['مصروفات']))) return false;
    return matches(q, [
      'مبيعات', 'إيرادات', 'المبيعات', 'sales', 'revenue', 'كم حققنا', 'كم بيعنا', 'كم كسبنا', 'كسبنا', 'كسب',
      'كم ربحنا', 'ربحنا', 'دخلنا', 'إجمالي المبيعات',
    ]);
  },
  process: async (ctx) => {
    const { companyId, query, period, can } = ctx;
    if (!can(PERMISSIONS.VIEW_SALES) && !can(PERMISSIONS.SALES_READ)) return null;

    // فترة محددة
    if (period) {
      const total = await ctx.chatFinancialMetrics.sumRevenue(companyId, period.start, period.end);
      const amt = `${formatReportMoneyInteger(total)} SR`;
      const amtEn = `${formatReportMoneyInteger(total)} SAR`;
      return {
        answerAr: ['## مبيعات الفترة', '', 'البند\tالمبلغ', `${period.labelAr}\t${amt}`].join('\n'),
        answerEn: ['## Sales for the period', '', 'Item\tAmount', `${period.labelEn}\t${amtEn}`].join('\n'),
      };
    }

    // السنة
    const total = await ctx.chatFinancialMetrics.annualSales(companyId, ctx.year);
    const amt = `${formatReportMoneyInteger(total)} SR`;
    const amtEn = `${formatReportMoneyInteger(total)} SAR`;
    return {
      answerAr: ['## مبيعات السنة', '', 'البند\tالمبلغ', `إجمالي المبيعات (${ctx.year})\t${amt}`].join('\n'),
      answerEn: ['## Annual sales', '', 'Item\tAmount', `Total sales (${ctx.year})\t${amtEn}`].join('\n'),
    };
  },
};

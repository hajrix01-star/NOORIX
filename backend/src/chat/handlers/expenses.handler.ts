import Decimal from 'decimal.js';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';
import { classifyDashboardInsightsQuery } from './dashboard-insights.handler';

export const expensesHandler: ChatHandler = {
  priority: 12,
  intent: 'expenses',
  matchesIntent: (intent, can) => intent === 'expenses' && can(PERMISSIONS.VIEW_VAULTS),
  canHandle: (q, can) =>
    classifyDashboardInsightsQuery(q) == null &&
    matches(q, ['مصروفات', 'مصاريف', 'المصروفات', 'expenses', 'كم صرفنا', 'إجمالي المصروفات']) &&
    can(PERMISSIONS.VIEW_VAULTS),
  process: async (ctx) => {
    const { companyId, period } = ctx;
    const { prisma, reportsService } = ctx;

    if (period) {
      const agg = await prisma.ledgerEntry.aggregate({
        where: {
          companyId,
          status: 'active',
          transactionDate: { gte: period.start, lte: period.end },
          debitAccount: { type: 'expense', code: { not: { startsWith: 'PUR' } } },
        },
        _sum: { amount: true },
      });
      const total = new Decimal(agg._sum.amount ?? 0).toFixed(2);
      const amt = `${Number(total).toLocaleString('en')} SR`;
      const amtEn = `${Number(total).toLocaleString('en')} SAR`;
      return {
        answerAr: ['## مصروفات الفترة', '', 'البند\tالمبلغ', `${period.labelAr}\t${amt}`].join('\n'),
        answerEn: ['## Expenses for the period', '', 'Item\tAmount', `${period.labelEn}\t${amtEn}`].join('\n'),
      };
    }

    const report = await reportsService.getGeneralProfitLoss(companyId, ctx.year);
    const total = report?.cards?.expenses ?? '0';
    const amt = `${Number(total).toLocaleString('en')} SR`;
    const amtEn = `${Number(total).toLocaleString('en')} SAR`;
    return {
      answerAr: ['## مصروفات السنة', '', 'البند\tالمبلغ', `إجمالي المصروفات (${ctx.year})\t${amt}`].join('\n'),
      answerEn: ['## Annual expenses', '', 'Item\tAmount', `Total expenses (${ctx.year})\t${amtEn}`].join('\n'),
    };
  },
};

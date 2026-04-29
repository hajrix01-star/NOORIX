import Decimal from 'decimal.js';
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
      const { prisma } = ctx;
      const agg = await prisma.ledgerEntry.aggregate({
        where: {
          companyId,
          status: 'active',
          transactionDate: { gte: period.start, lte: period.end },
          creditAccount: { type: 'revenue' },
        },
        _sum: { amount: true },
      });
      const total = new Decimal(agg._sum.amount ?? 0).toFixed(2);
      const amt = `${Number(total).toLocaleString('en')} SR`;
      const amtEn = `${Number(total).toLocaleString('en')} SAR`;
      return {
        answerAr: ['## مبيعات الفترة', '', 'البند\tالمبلغ', `${period.labelAr}\t${amt}`].join('\n'),
        answerEn: ['## Sales for the period', '', 'Item\tAmount', `${period.labelEn}\t${amtEn}`].join('\n'),
      };
    }

    // السنة
    const { reportsService } = ctx;
    const report = await reportsService.getGeneralProfitLoss(companyId, ctx.year);
    const total = report?.cards?.sales ?? '0';
    const amt = `${Number(total).toLocaleString('en')} SR`;
    const amtEn = `${Number(total).toLocaleString('en')} SAR`;
    return {
      answerAr: ['## مبيعات السنة', '', 'البند\tالمبلغ', `إجمالي المبيعات (${ctx.year})\t${amt}`].join('\n'),
      answerEn: ['## Annual sales', '', 'Item\tAmount', `Total sales (${ctx.year})\t${amtEn}`].join('\n'),
    };
  },
};

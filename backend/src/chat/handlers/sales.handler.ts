import Decimal from 'decimal.js';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches, parsePeriod } from './utils';

export const salesHandler: ChatHandler = {
  priority: 10,
  intent: 'sales',
  matchesIntent: (intent, can) => intent === 'sales' && (can(PERMISSIONS.VIEW_SALES) || can(PERMISSIONS.SALES_READ)),
  canHandle: (q, can) =>
    matches(q, ['مبيعات', 'إيرادات', 'المبيعات', 'sales', 'revenue', 'كم حققنا', 'كم بيعنا', 'كم كسبنا', 'كسبنا', 'كسب', 'كم ربحنا', 'ربحنا', 'دخلنا', 'إجمالي المبيعات']) && (can(PERMISSIONS.VIEW_SALES) || can(PERMISSIONS.SALES_READ)),
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
      return {
        answerAr: `مبيعات ${period.labelAr}: ${Number(total).toLocaleString('en')} ﷼`,
        answerEn: `Sales ${period.labelEn}: ${Number(total).toLocaleString('en')} SAR`,
      };
    }

    // السنة
    const { reportsService } = ctx;
    const report = await reportsService.getGeneralProfitLoss(companyId, ctx.year);
    const total = report?.cards?.sales ?? '0';
    return {
      answerAr: `مبيعات السنة ${ctx.year}: ${Number(total).toLocaleString('en')} ﷼`,
      answerEn: `Sales for ${ctx.year}: ${Number(total).toLocaleString('en')} SAR`,
    };
  },
};

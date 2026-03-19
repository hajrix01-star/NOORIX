import Decimal from 'decimal.js';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';

export const purchasesHandler: ChatHandler = {
  priority: 11,
  intent: 'purchases',
  matchesIntent: (intent, can) => intent === 'purchases' && can(PERMISSIONS.VIEW_INVOICES),
  canHandle: (q, can) =>
    matches(q, ['مشتريات', 'المشتريات', 'purchases', 'كم اشترينا', 'إجمالي المشتريات']) && can(PERMISSIONS.VIEW_INVOICES),
  process: async (ctx) => {
    const { companyId, period } = ctx;
    const { prisma, reportsService } = ctx;

    if (period) {
      const agg = await prisma.ledgerEntry.aggregate({
        where: {
          companyId,
          status: 'active',
          transactionDate: { gte: period.start, lte: period.end },
          debitAccount: { code: { startsWith: 'PUR' } },
        },
        _sum: { amount: true },
      });
      const total = new Decimal(agg._sum.amount ?? 0).toFixed(2);
      return {
        answerAr: `مشتريات ${period.labelAr}: ${Number(total).toLocaleString('en')} ﷼`,
        answerEn: `Purchases ${period.labelEn}: ${Number(total).toLocaleString('en')} SAR`,
      };
    }

    const report = await reportsService.getGeneralProfitLoss(companyId, ctx.year);
    const total = report?.cards?.purchases ?? '0';
    return {
      answerAr: `مشتريات السنة ${ctx.year}: ${Number(total).toLocaleString('en')} ﷼`,
      answerEn: `Purchases for ${ctx.year}: ${Number(total).toLocaleString('en')} SAR`,
    };
  },
};

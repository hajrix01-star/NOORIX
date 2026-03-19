import Decimal from 'decimal.js';
import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';

export const expensesHandler: ChatHandler = {
  priority: 12,
  intent: 'expenses',
  matchesIntent: (intent, can) => intent === 'expenses' && can(PERMISSIONS.VIEW_VAULTS),
  canHandle: (q, can) =>
    matches(q, ['مصروفات', 'مصاريف', 'المصروفات', 'expenses', 'كم صرفنا', 'إجمالي المصروفات']) && can(PERMISSIONS.VIEW_VAULTS),
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
      return {
        answerAr: `مصروفات ${period.labelAr}: ${Number(total).toLocaleString('en')} ﷼`,
        answerEn: `Expenses ${period.labelEn}: ${Number(total).toLocaleString('en')} SAR`,
      };
    }

    const report = await reportsService.getGeneralProfitLoss(companyId, ctx.year);
    const total = report?.cards?.expenses ?? '0';
    return {
      answerAr: `مصروفات السنة ${ctx.year}: ${Number(total).toLocaleString('en')} ﷼`,
      answerEn: `Expenses for ${ctx.year}: ${Number(total).toLocaleString('en')} SAR`,
    };
  },
};

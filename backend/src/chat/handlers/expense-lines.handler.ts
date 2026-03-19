import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';

export const expenseLinesHandler: ChatHandler = {
  priority: 23,
  intent: 'expense_lines',
  matchesIntent: (intent, can) => intent === 'expense_lines' && can(PERMISSIONS.INVOICES_READ),
  canHandle: (q, can) =>
    matches(q, ['بنود مصروفات', 'بند مصروف', 'expense line', 'بنود المصروفات']) && can(PERMISSIONS.INVOICES_READ),
  process: async (ctx) => {
    const { companyId } = ctx;
    const { prisma } = ctx;
    const count = await prisma.expenseLine.count({ where: { companyId, isActive: true } });
    return {
      answerAr: `عدد بنود المصروفات: ${count}`,
      answerEn: `Number of expense lines: ${count}`,
    };
  },
};

import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';

export const categoriesHandler: ChatHandler = {
  priority: 22,
  intent: 'categories',
  matchesIntent: (intent, can) => intent === 'categories' && can(PERMISSIONS.SUPPLIERS_READ),
  canHandle: (q, can) =>
    matches(q, ['فئات', 'فئة', 'category', 'categories', 'الفئات', 'عدد الفئات']) && can(PERMISSIONS.SUPPLIERS_READ),
  process: async (ctx) => {
    const { companyId } = ctx;
    const { prisma } = ctx;
    const count = await prisma.category.count({ where: { companyId, isActive: true } });
    return {
      answerAr: `عدد الفئات النشطة: ${count}`,
      answerEn: `Number of active categories: ${count}`,
    };
  },
};

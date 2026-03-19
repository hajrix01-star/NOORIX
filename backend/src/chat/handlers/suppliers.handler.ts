import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';

export const suppliersHandler: ChatHandler = {
  priority: 21,
  intent: 'suppliers',
  matchesIntent: (intent, can) => intent === 'suppliers' && can(PERMISSIONS.SUPPLIERS_READ),
  canHandle: (q, can) =>
    matches(q, ['موردين', 'مورد', 'supplier', 'الموردين', 'عدد الموردين']) && can(PERMISSIONS.SUPPLIERS_READ),
  process: async (ctx) => {
    const { companyId } = ctx;
    const { prisma } = ctx;
    const count = await prisma.supplier.count({ where: { companyId, isDeleted: false } });
    return {
      answerAr: `عدد الموردين المسجلين: ${count}`,
      answerEn: `Number of registered suppliers: ${count}`,
    };
  },
};

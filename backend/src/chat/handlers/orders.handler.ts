import { PERMISSIONS } from '../../auth/constants/permissions';
import type { ChatHandler, ChatHandlerContext } from './types';
import { matches } from './utils';

export const ordersHandler: ChatHandler = {
  priority: 40,
  intent: 'orders',
  matchesIntent: (intent, can) => intent === 'orders' && can(PERMISSIONS.VIEW_SALES),
  canHandle: (q, can) =>
    matches(q, ['أصناف', 'صنف', 'منتجات', 'طلبات', 'order', 'product', 'فئات الطلبات']) && can(PERMISSIONS.VIEW_SALES),
  process: async (ctx) => {
    const { companyId } = ctx;
    const { prisma } = ctx;
    const [orderCount, productCount, catCount] = await Promise.all([
      prisma.order.count({ where: { companyId } }),
      prisma.orderProduct.count({ where: { companyId, isActive: true } }),
      prisma.orderCategory.count({ where: { companyId, isActive: true } }),
    ]);
    return {
      answerAr: `الطلبات: ${orderCount} | أصناف المنتجات: ${productCount} | فئات الطلبات: ${catCount}`,
      answerEn: `Orders: ${orderCount} | Products: ${productCount} | Order categories: ${catCount}`,
    };
  },
};

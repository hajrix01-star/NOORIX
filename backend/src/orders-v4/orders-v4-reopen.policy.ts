import { Prisma } from '@prisma/client';
import { ordersV4DateOnly, ordersV4RecentDateWindow, ordersV4SaudiToday } from './orders-v4-date.util';

export const ORDERS_V4_REOPEN_WINDOW_DAYS = 7;
export const ORDERS_V4_CASHIER_REOPEN_LIMIT = 5;
export type OrdersV4ReopenAccess = 'owner' | 'cashier';

export function ordersV4CashierRecentPurchasesQuery(companyId: string) {
  return {
    where: {
      companyId,
      documentType: 'purchase',
      status: 'received',
      reversalOfId: null,
    },
    orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
    take: ORDERS_V4_CASHIER_REOPEN_LIMIT,
    select: { id: true },
  } satisfies Prisma.OrdersV4DocumentFindManyArgs;
}

export function isOrdersV4CashierReopenEligible(documentId: string, recentDocumentIds: readonly string[]): boolean {
  return recentDocumentIds.includes(documentId);
}

export function ordersV4ReopenDateRange(todayYmd = ordersV4SaudiToday()): { gte: Date; lte: Date } {
  const { startDate, endDate } = ordersV4RecentDateWindow(todayYmd, ORDERS_V4_REOPEN_WINDOW_DAYS);
  return {
    gte: ordersV4DateOnly(startDate, 'بداية نطاق إعادة الفتح'),
    lte: ordersV4DateOnly(endDate, 'نهاية نطاق إعادة الفتح'),
  };
}

export function isOrdersV4ReopenDateEligible(documentDate: Date, todayYmd = ordersV4SaudiToday()): boolean {
  const range = ordersV4ReopenDateRange(todayYmd);
  return documentDate >= range.gte && documentDate <= range.lte;
}

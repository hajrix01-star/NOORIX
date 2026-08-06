import { Prisma } from '@prisma/client';
import { ordersV4DateOnly, ordersV4RecentDateWindow, ordersV4SaudiToday } from './orders-v4-date.util';

export const ORDERS_V4_REOPEN_WINDOW_DAYS = 7;
export const ORDERS_V4_CASHIER_EDIT_LIMIT = 5;
export type OrdersV4ReopenAccess = 'owner' | 'cashier';

/**
 * The single source of truth for the cashier's editable purchase window.
 * Business dates are intentionally not used for ranking because users can
 * backdate a document. Creation order plus the id tie-breaker is immutable and
 * deterministic across listing, receiving, reopening and correction.
 */
export function ordersV4CashierRecentEditablePurchasesQuery(companyId: string) {
  return {
    where: {
      companyId,
      documentType: 'purchase',
      status: { in: ['prepared', 'received'] },
      reversalOfId: null,
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: ORDERS_V4_CASHIER_EDIT_LIMIT,
    select: { id: true },
  } satisfies Prisma.OrdersV4DocumentFindManyArgs;
}

export function isOrdersV4CashierEditEligible(documentId: string, recentDocumentIds: readonly string[]): boolean {
  return recentDocumentIds.includes(documentId);
}

/** The owner keeps the seven-day window and can never be less capable than the cashier. */
export function isOrdersV4OwnerEditEligible(
  documentId: string,
  documentDate: Date,
  recentDocumentIds: readonly string[],
  todayYmd = ordersV4SaudiToday(),
): boolean {
  return isOrdersV4ReopenDateEligible(documentDate, todayYmd)
    || isOrdersV4CashierEditEligible(documentId, recentDocumentIds);
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

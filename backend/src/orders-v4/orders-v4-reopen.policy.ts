import { Prisma } from '@prisma/client';
import { ordersV4DateOnly, ordersV4RecentDateWindow, ordersV4SaudiToday } from './orders-v4-date.util';

/** Daily safety window for routine cashier work. Owner-approved documents are an explicit exception. */
export const ORDERS_V4_CASHIER_EDIT_WINDOW_DAYS = 10;
export const ORDERS_V4_CASHIER_CREATE_FUTURE_DAYS = 1;
export type OrdersV4DocumentDateAccess = 'owner' | 'staff';
export type OrdersV4ReopenAccess = 'owner' | 'cashier';

/**
 * The single source of truth for the cashier's editable purchase window.
 * The window is based on the purchase business date: staff may work on the
 * current date and the preceding nine business dates. Any historical exception
 * must be explicitly delegated by the owner for that one document.
 */
export function ordersV4CashierEditDateRange(todayYmd = ordersV4SaudiToday()): { gte: Date; lte: Date } {
  const { startDate, endDate } = ordersV4RecentDateWindow(todayYmd, ORDERS_V4_CASHIER_EDIT_WINDOW_DAYS);
  return {
    gte: ordersV4DateOnly(startDate, 'بداية نطاق إعادة الفتح'),
    lte: ordersV4DateOnly(endDate, 'نهاية نطاق إعادة الفتح'),
  };
}

export function isOrdersV4CashierEditEligible(documentDate: Date, todayYmd = ordersV4SaudiToday()): boolean {
  const range = ordersV4CashierEditDateRange(todayYmd);
  return documentDate >= range.gte && documentDate <= range.lte;
}

/**
 * Staff may prepare a document for today, a recent correction day, or tomorrow.
 * Tomorrow is intentionally allowed for the next operational shift, while receipt
 * itself remains limited to today and the preceding nine days.
 */
export function ordersV4StaffDocumentDateRange(todayYmd = ordersV4SaudiToday()): { gte: Date; lte: Date } {
  const recent = ordersV4CashierEditDateRange(todayYmd);
  const tomorrow = new Date(recent.lte);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + ORDERS_V4_CASHIER_CREATE_FUTURE_DAYS);
  return { gte: recent.gte, lte: tomorrow };
}

export function isOrdersV4StaffDocumentDateEligible(documentDate: Date, todayYmd = ordersV4SaudiToday()): boolean {
  const range = ordersV4StaffDocumentDateRange(todayYmd);
  return documentDate >= range.gte && documentDate <= range.lte;
}

/**
 * Owner delegation is intentionally stored in the immutable document workflow
 * snapshot. It grants the cashier access to this document only; it never
 * broadens access to other historical documents.
 */
export function hasOrdersV4OwnerReopenDelegation(snapshot: Prisma.JsonValue | null | undefined): boolean {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  const value = snapshot as Record<string, unknown>;
  return typeof value.ownerReopenDelegatedAt === 'string' && !value.ownerReopenConsumedAt;
}

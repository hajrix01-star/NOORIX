import { ordersV4DateOnly, ordersV4RecentDateWindow, ordersV4SaudiToday } from './orders-v4-date.util';

export const ORDERS_V4_REOPEN_WINDOW_DAYS = 7;

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

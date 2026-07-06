import { parseInvoiceDayBoundary } from './invoice-date.util';

/** فلتر `transactionDate` بصيغة YYYY-MM-DD (بداية/نهاية UTC) — مطابق لقائمة الفواتير و`SalesService`. */
export function buildInvoiceTransactionDateFilter(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return {};
  return {
    transactionDate: {
      ...(startDate ? { gte: parseInvoiceDayBoundary(startDate, 'start') } : {}),
      ...(endDate ? { lte: parseInvoiceDayBoundary(endDate, 'end') } : {}),
    },
  };
}

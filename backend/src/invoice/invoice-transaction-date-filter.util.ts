import { toYmd } from '../common/utils/to-ymd.util';

/** فلتر `transactionDate` بصيغة YYYY-MM-DD (بداية/نهاية UTC) — مطابق لقائمة الفواتير و`SalesService`. */
export function buildInvoiceTransactionDateFilter(startDate?: string, endDate?: string) {
  if (!startDate && !endDate) return {};
  return {
    transactionDate: {
      ...(startDate ? { gte: new Date(`${toYmd(startDate)}T00:00:00.000Z`) } : {}),
      ...(endDate ? { lte: new Date(`${toYmd(endDate)}T23:59:59.999Z`) } : {}),
    },
  };
}

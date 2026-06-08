import { toYmd } from '../common/utils/to-ymd.util';

/** تاريخ العرض DD-MM-YYYY لرقم العملية الداخلية */
export function staffSaleLogRefDateLabel(saleDate: Date): string {
  const ymd = toYmd(saleDate);
  const [y, m, d] = ymd.split('-');
  return `${d}-${m}-${y}`;
}

/** بادئة رقم العملية: 08-06-2026- */
export function staffSaleLogRefPrefix(saleDate: Date): string {
  return `${staffSaleLogRefDateLabel(saleDate)}-`;
}

/** 1→A, 2→B, … 26→Z, 27→AA */
export function staffSaleLogRefLetter(sequence1Based: number): string {
  let n = Math.max(1, Math.floor(sequence1Based));
  let result = '';
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

export function buildStaffSaleLogRef(saleDate: Date, sequence1Based: number): string {
  return `${staffSaleLogRefPrefix(saleDate)}${staffSaleLogRefLetter(sequence1Based)}`;
}

/** مفتاح تجميع العملية — logRef أو id للسجلات القديمة */
export function staffSaleOperationKey(order: { id: string; logRef?: string | null }): string {
  return order.logRef?.trim() || order.id;
}

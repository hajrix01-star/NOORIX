import { toYmd } from '../common/utils/to-ymd.util';

/** بادئة رقم العملية الداخلية: L-YYMMDD- */
export function staffSaleLogRefPrefix(saleDate: Date): string {
  const ymd = toYmd(saleDate).replace(/-/g, '').slice(2);
  return `L-${ymd}-`;
}

export function buildStaffSaleLogRef(prefix: string, sequence1Based: number): string {
  return `${prefix}${String(sequence1Based).padStart(3, '0')}`;
}

/** مفتاح تجميع العملية — logRef أو id للسجلات القديمة */
export function staffSaleOperationKey(order: { id: string; logRef?: string | null }): string {
  return order.logRef?.trim() || order.id;
}

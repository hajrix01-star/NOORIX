/**
 * بادئة تاريخ لرقم طلب ORD-YYYYMMDD-xxx
 */
export function orderGregorianDateToNumberPrefix(orderDate: string): string {
  return orderDate.replace(/-/g, '').slice(0, 8);
}

export function buildOrderNumberFromPrefix(ymd: string, sequence1Based: number): string {
  return `ORD-${ymd}-${String(sequence1Based).padStart(3, '0')}`;
}

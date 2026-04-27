import { toYmd } from '../../../utils/saudiDate';

/**
 * رابط قائمة الفواتير مُصفّى بتاريخ العملية لتسهيل إيجاد سجل مشتريات جديد بعد ربط OCR.
 */
export function invoicesHrefForLinkedPurchase(row: any) {
  if (!row?.id) return '/invoices?kind=purchase';
  const tx = row.transactionDate ? toYmd(row.transactionDate) : '';
  if (tx.length === 10) return `/invoices?from=${tx}&to=${tx}&kind=purchase`;
  return '/invoices?kind=purchase';
}

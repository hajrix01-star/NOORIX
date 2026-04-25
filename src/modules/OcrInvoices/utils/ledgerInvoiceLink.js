/**
 * رابط قائمة الفواتير مُصفّى بتاريخ العملية لتسهيل إيجاد سجل مشتريات جديد بعد ربط OCR.
 */
export function invoicesHrefForLinkedPurchase(row) {
  if (!row?.id) return '/invoices?kind=purchase';
  const tx = row.transactionDate ? String(row.transactionDate).slice(0, 10) : '';
  if (tx.length === 10) return `/invoices?from=${tx}&to=${tx}&kind=purchase`;
  return '/invoices?kind=purchase';
}

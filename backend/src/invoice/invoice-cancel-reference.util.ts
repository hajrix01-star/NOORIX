/**
 * نوع المرجع لإلغاء فاتورة في المحرك المالي (مبيعات/راتب/سُلفة/صرف).
 */
export function resolveInvoiceCancelReferenceType(kind: string): 'sale' | 'salary' | 'advance' | 'invoice' {
  if (kind === 'sale') return 'sale';
  if (kind === 'salary') return 'salary';
  if (kind === 'advance') return 'advance';
  return 'invoice';
}

export function resolveInvoiceCancelReferenceId(
  kind: string,
  invoiceId: string,
  dailySalesSummaryId: string | null,
): string {
  if (kind === 'sale' && dailySalesSummaryId) return dailySalesSummaryId;
  return invoiceId;
}

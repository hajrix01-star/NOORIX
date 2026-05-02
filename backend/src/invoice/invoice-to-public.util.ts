/**
 * إخفاء مسار المرفق عن JSON — علامة hasInvoiceAttachment.
 */
export function toPublicInvoiceView<
  I extends {
    attachmentPath?: string | null;
    attachmentOriginalName?: string | null;
    supplierInvoiceDedupKey?: string | null;
  },
>(
  inv: I,
): Omit<I, 'attachmentPath' | 'supplierInvoiceDedupKey'> & { hasInvoiceAttachment: boolean } {
  const { attachmentPath, supplierInvoiceDedupKey: _dedup, ...rest } = inv;
  const hasInvoiceAttachment = !!(attachmentPath && String(attachmentPath).trim());
  return {
    ...(rest as Omit<I, 'attachmentPath' | 'supplierInvoiceDedupKey'>),
    hasInvoiceAttachment,
  };
}

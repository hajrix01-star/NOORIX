/**
 * إخفاء مسار المرفق عن JSON — علامة hasInvoiceAttachment.
 */
export function toPublicInvoiceView<I extends { attachmentPath?: string | null; attachmentOriginalName?: string | null }>(
  inv: I,
): Omit<I, 'attachmentPath'> & { hasInvoiceAttachment: boolean } {
  const { attachmentPath, ...rest } = inv;
  const hasInvoiceAttachment = !!(attachmentPath && String(attachmentPath).trim());
  return {
    ...(rest as Omit<I, 'attachmentPath'>),
    hasInvoiceAttachment,
  };
}

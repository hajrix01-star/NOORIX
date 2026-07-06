export type InvoiceAttachmentMeta = {
  has: boolean;
  name: string | null;
};

export type InvoiceAttachmentResponseData = {
  hasInvoiceAttachment?: boolean | null;
  attachmentOriginalName?: string | null;
};

export type InvoiceAttachmentSource = {
  hasInvoiceAttachment?: boolean | null;
  attachmentOriginalName?: string | null;
};

export function normalizeInvoiceAttachmentResponseData(value: unknown): InvoiceAttachmentResponseData {
  if (!value || typeof value !== 'object') return {};
  const hasInvoiceAttachment =
    'hasInvoiceAttachment' in value && typeof value.hasInvoiceAttachment === 'boolean'
      ? value.hasInvoiceAttachment
      : undefined;
  const attachmentOriginalName =
    'attachmentOriginalName' in value && value.attachmentOriginalName != null
      ? String(value.attachmentOriginalName)
      : undefined;
  return { hasInvoiceAttachment, attachmentOriginalName };
}

export function getInvoiceAttachmentMeta(source: InvoiceAttachmentSource | null | undefined): InvoiceAttachmentMeta {
  return {
    has: Boolean(source?.hasInvoiceAttachment),
    name: source?.attachmentOriginalName || null,
  };
}

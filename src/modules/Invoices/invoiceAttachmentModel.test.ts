import { describe, expect, it } from 'vitest';
import { getInvoiceAttachmentMeta, normalizeInvoiceAttachmentResponseData } from './invoiceAttachmentModel';

describe('invoiceAttachmentModel', () => {
  it('normalizes attachment response data safely', () => {
    expect(normalizeInvoiceAttachmentResponseData(null)).toEqual({});
    expect(
      normalizeInvoiceAttachmentResponseData({
        hasInvoiceAttachment: true,
        attachmentOriginalName: 123,
      }),
    ).toEqual({ hasInvoiceAttachment: true, attachmentOriginalName: '123' });
  });

  it('builds attachment display metadata', () => {
    expect(getInvoiceAttachmentMeta({ hasInvoiceAttachment: true, attachmentOriginalName: 'receipt.pdf' })).toEqual({
      has: true,
      name: 'receipt.pdf',
    });
    expect(getInvoiceAttachmentMeta(undefined)).toEqual({ has: false, name: null });
  });
});

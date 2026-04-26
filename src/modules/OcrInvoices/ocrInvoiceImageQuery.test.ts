import { describe, it, expect } from 'vitest';
import { ocrInvoiceImageQueryKey } from './ocrInvoiceImageQuery';

describe('ocrInvoiceImageQueryKey', () => {
  it('is stable and unique per company + invoice', () => {
    expect(ocrInvoiceImageQueryKey('c1', 'inv1')).toEqual(['ocr-invoice-image', 'c1', 'inv1']);
    expect(ocrInvoiceImageQueryKey('c1', 'inv1')).toEqual(ocrInvoiceImageQueryKey('c1', 'inv1'));
    expect(ocrInvoiceImageQueryKey('c1', 'inv1')).not.toEqual(ocrInvoiceImageQueryKey('c2', 'inv1'));
  });
});

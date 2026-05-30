import { buildAutoSaveDtoFromEnriched, shouldAutoFinalizeOcrSubmission } from './ocr-auto-finalize.util';
import { PERMISSIONS } from '../auth/constants/permissions';

describe('buildAutoSaveDtoFromEnriched', () => {
  it('returns null when no items and no total', () => {
    expect(buildAutoSaveDtoFromEnriched('inv-1', {})).toBeNull();
  });

  it('maps enriched extraction to save dto', () => {
    const dto = buildAutoSaveDtoFromEnriched('inv-1', {
      supplier: { name: 'Acme' },
      invoiceNumber: { value: 'INV-9' },
      invoiceDate: { value: '2026-05-01' },
      subtotalAmount: { value: 100 },
      totalAmount: { value: 115 },
      vatAmount: { value: 15 },
      items: [
        {
          name: 'Item A',
          quantity: 2,
          unitPrice: 50,
          totalPrice: 100,
          confidence: 0.9,
          itemMatch: { id: 'item-1', status: 'auto' },
        },
      ],
    });

    expect(dto).toMatchObject({
      id: 'inv-1',
      supplierName: 'Acme',
      invoiceNumber: 'INV-9',
      invoiceDate: '2026-05-01',
      subtotalAmount: 100,
      totalAmount: 115,
      vatAmount: 15,
      lines: [
        expect.objectContaining({
          rawName: 'Item A',
          itemId: 'item-1',
          quantity: 2,
        }),
      ],
    });
  });
});

describe('shouldAutoFinalizeOcrSubmission', () => {
  it('allows auto-save when there is no submitter (legacy upload)', () => {
    expect(shouldAutoFinalizeOcrSubmission(null, undefined)).toBe(true);
  });

  it('skips auto-save for OCR_SUBMIT-only staff', () => {
    expect(
      shouldAutoFinalizeOcrSubmission('user-1', {
        userId: 'user-1',
        role: 'cashier',
        permissions: [PERMISSIONS.OCR_SUBMIT],
      }),
    ).toBe(false);
  });

  it('allows auto-save when submitter has OCR_READ', () => {
    expect(
      shouldAutoFinalizeOcrSubmission('user-2', {
        userId: 'user-2',
        role: 'accountant',
        permissions: [PERMISSIONS.OCR_READ, PERMISSIONS.OCR_WRITE],
      }),
    ).toBe(true);
  });
});

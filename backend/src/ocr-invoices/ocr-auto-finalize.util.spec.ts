import { buildAutoSaveDtoFromEnriched } from './ocr-auto-finalize.util';

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

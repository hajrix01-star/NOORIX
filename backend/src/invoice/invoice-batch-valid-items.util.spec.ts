import { filterValidInvoiceBatchLineItems } from './invoice-batch-valid-items.util';
import type { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';

function item(overrides: Partial<CreateInvoiceBatchDto['items'][number]>): CreateInvoiceBatchDto['items'][number] {
  return {
    kind: 'purchase',
    totalAmount: 100,
    isTaxable: true,
    ...overrides,
  };
}

describe('filterValidInvoiceBatchLineItems', () => {
  it('matches shared purchase batch validity for mixed purchase/expense rows', () => {
    const rows = [
      item({ supplierId: 'supplier-1', supplierInvoiceNumber: 'INV-1' }),
      item({ supplierId: 'supplier-2', supplierInvoiceNumber: undefined, isTaxable: true }),
      item({ supplierId: 'supplier-3', supplierInvoiceNumber: undefined, isTaxable: false }),
      item({ kind: 'expense', supplierId: undefined, notes: 'service', totalAmount: 45 }),
      item({ kind: 'fixed_expense', supplierId: undefined, notes: undefined, totalAmount: 60 }),
      item({ kind: 'expense', supplierId: undefined, notes: 'zero', totalAmount: 0 }),
    ];

    const valid = filterValidInvoiceBatchLineItems(rows, 'batch note');

    expect(valid).toHaveLength(4);
    expect(valid).toEqual([rows[0], rows[2], rows[3], rows[4]]);
  });
});

import { describe, expect, it } from '@jest/globals';
import { computeCreateInvoiceOutflowNetAndTax } from './invoice-create-outflow-prep.util';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';

describe('computeCreateInvoiceOutflowNetAndTax', () => {
  it('ignores client-provided net/tax and recomputes from the server total/rate', () => {
    const dto = {
      companyId: 'c1',
      kind: 'purchase',
      transactionDate: '2026-06-20',
      totalAmount: '1000',
      isTaxable: true,
      netAmount: '900',
      taxAmount: '100',
    } as unknown as CreateInvoiceDto;
    expect(computeCreateInvoiceOutflowNetAndTax(dto, 15)).toEqual({
      net: '869.5700',
      tax: '130.4300',
    });
  });

  it('computes balanced split at company rate', () => {
    const dto = {
      companyId: 'c1',
      kind: 'purchase',
      transactionDate: '2026-06-20',
      totalAmount: '1000',
      isTaxable: true,
    } as unknown as CreateInvoiceDto;
    const { net, tax } = computeCreateInvoiceOutflowNetAndTax(dto, 15);
    expect(Number(net) + Number(tax)).toBeCloseTo(1000, 4);
  });
});

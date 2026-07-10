import { describe, expect, it } from '@jest/globals';
import { computeCreateInvoiceOutflowNetAndTax } from './invoice-create-outflow-prep.util';
import type { CreateInvoiceDto } from './dto/create-invoice.dto';

type CreateInvoiceDtoWithClientTotals = CreateInvoiceDto & {
  netAmount?: string;
  taxAmount?: string;
};

describe('computeCreateInvoiceOutflowNetAndTax', () => {
  it('ignores client-provided net/tax and recomputes from the server total/rate', () => {
    const dto: CreateInvoiceDtoWithClientTotals = {
      companyId: 'c1',
      kind: 'purchase',
      transactionDate: '2026-06-20',
      totalAmount: 1000,
      isTaxable: true,
      netAmount: '900',
      taxAmount: '100',
    };
    expect(computeCreateInvoiceOutflowNetAndTax(dto, 15)).toEqual({
      net: '869.5700',
      tax: '130.4300',
    });
  });

  it('computes balanced split at company rate', () => {
    const dto: CreateInvoiceDto = {
      companyId: 'c1',
      kind: 'purchase',
      transactionDate: '2026-06-20',
      totalAmount: 1000,
      isTaxable: true,
    };
    const { net, tax } = computeCreateInvoiceOutflowNetAndTax(dto, 15);
    expect(Number(net) + Number(tax)).toBeCloseTo(1000, 4);
  });
});

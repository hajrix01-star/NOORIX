import { describe, expect, it } from '@jest/globals';
import {
  assertCreateInvoiceSupplierInvoiceNumberIfRequired,
  computeCreateInvoiceOutflowNetAndTax,
} from './invoice-create-outflow-prep.util';
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

describe('assertCreateInvoiceSupplierInvoiceNumberIfRequired', () => {
  const base = {
    companyId: 'company-1',
    kind: 'expense',
    supplierId: 'supplier-1',
    expenseLineId: 'line-1',
    totalAmount: 100,
    transactionDate: '2026-07-28',
    isTaxable: true,
  } as const;

  it('keeps the number required for taxable variable expenses', () => {
    expect(() => assertCreateInvoiceSupplierInvoiceNumberIfRequired(base)).toThrow();
  });

  it('allows fixed expenses without a supplier invoice number', () => {
    expect(() => assertCreateInvoiceSupplierInvoiceNumberIfRequired({
      ...base,
      kind: 'fixed_expense',
    })).not.toThrow();
  });

  it('allows government non-taxable expenses without a supplier invoice number', () => {
    expect(() => assertCreateInvoiceSupplierInvoiceNumberIfRequired({
      ...base,
      isTaxable: false,
    })).not.toThrow();
  });
});

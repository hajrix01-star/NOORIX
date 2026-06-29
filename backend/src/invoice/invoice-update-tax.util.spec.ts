import { Prisma } from '@prisma/client';
import { buildInvoiceOutflowTaxUpdate } from './invoice-update-tax.util';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';

const oldInvoice = (totalAmount: number, taxAmount: number) => ({
  kind: 'expense',
  totalAmount: new Prisma.Decimal(totalAmount),
  taxAmount: new Prisma.Decimal(taxAmount),
});

describe('buildInvoiceOutflowTaxUpdate', () => {
  it('turns a taxable invoice into non-taxable when dto.isTaxable is false', () => {
    const patch = buildInvoiceOutflowTaxUpdate(
      oldInvoice(115, 15),
      { isTaxable: false },
      15,
    );

    expect(patch?.netAmount?.toString()).toBe('115');
    expect(patch?.taxAmount?.toString()).toBe('0');
  });

  it('turns a non-taxable invoice into taxable when dto.isTaxable is true', () => {
    const patch = buildInvoiceOutflowTaxUpdate(
      oldInvoice(115, 0),
      { isTaxable: true },
      15,
    );

    expect(patch?.netAmount?.toString()).toBe('100');
    expect(patch?.taxAmount?.toString()).toBe('15');
  });

  it('keeps tax zero when total changes with dto.isTaxable false', () => {
    const patch = buildInvoiceOutflowTaxUpdate(
      oldInvoice(115, 15),
      { totalAmount: 230, isTaxable: false },
      15,
    );

    expect(patch?.netAmount?.toString()).toBe('230');
    expect(patch?.taxAmount?.toString()).toBe('0');
  });

  it('ignores client-provided net/tax and recomputes from total/isTaxable', () => {
    const patch = buildInvoiceOutflowTaxUpdate(
      oldInvoice(115, 15),
      { totalAmount: 230, isTaxable: true, netAmount: 1, taxAmount: 229 } as UpdateInvoiceDto & {
        netAmount: number;
        taxAmount: number;
      },
      15,
    );

    expect(patch?.netAmount?.toString()).toBe('200');
    expect(patch?.taxAmount?.toString()).toBe('30');
  });
});

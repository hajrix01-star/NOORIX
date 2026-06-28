import { Prisma } from '@prisma/client';
import { buildInvoiceUncheckedUpdateFromDto } from './invoice-build-update-data.util';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';

describe('buildInvoiceUncheckedUpdateFromDto', () => {
  it('does not persist client-provided net/tax amounts directly', () => {
    const update = buildInvoiceUncheckedUpdateFromDto({
      totalAmount: 1150,
      netAmount: 1,
      taxAmount: 1149,
    } as UpdateInvoiceDto);

    expect(update.totalAmount).toEqual(new Prisma.Decimal(1150));
    expect(update.netAmount).toBeUndefined();
    expect(update.taxAmount).toBeUndefined();
  });
});

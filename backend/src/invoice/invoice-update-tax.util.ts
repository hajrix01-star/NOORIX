import { Prisma } from '@prisma/client';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { computeOutflowNetTaxFromTotal } from './invoice-outflow-tax.util';

export type InvoiceTaxBaseline = {
  totalAmount: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  kind: string;
};

export function shouldRecomputeInvoiceOutflowTax(dto: UpdateInvoiceDto): boolean {
  return dto.totalAmount !== undefined || dto.isTaxable !== undefined;
}

export function buildInvoiceOutflowTaxUpdate(
  oldInvoice: InvoiceTaxBaseline,
  dto: UpdateInvoiceDto,
  vatRatePercent?: number | string | null,
): Pick<Prisma.InvoiceUncheckedUpdateInput, 'netAmount' | 'taxAmount'> | null {
  if (!shouldRecomputeInvoiceOutflowTax(dto) || oldInvoice.kind === 'sale') {
    return null;
  }

  const total = dto.totalAmount !== undefined ? dto.totalAmount : oldInvoice.totalAmount;
  const isTaxable = dto.isTaxable !== undefined ? dto.isTaxable : oldInvoice.taxAmount.gt(0);
  const { net, tax } = computeOutflowNetTaxFromTotal(total, isTaxable, vatRatePercent ?? null);

  return {
    netAmount: new Prisma.Decimal(net),
    taxAmount: new Prisma.Decimal(tax),
  };
}

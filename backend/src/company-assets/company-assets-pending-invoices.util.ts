import { Prisma } from '@prisma/client';

export const pendingWarrantyInvoiceInclude = {
  supplier: { select: { id: true, nameAr: true, nameEn: true } },
  expenseLine: {
    select: {
      nameAr: true,
      nameEn: true,
      supplier: { select: { id: true, nameAr: true, nameEn: true } },
    },
  },
} satisfies Prisma.InvoiceInclude;

type PendingWarrantyInvoiceRow = Prisma.InvoiceGetPayload<{
  include: typeof pendingWarrantyInvoiceInclude;
}>;

export function mapPendingWarrantyInvoice(inv: PendingWarrantyInvoiceRow) {
  const supplier = inv.supplier ?? inv.expenseLine?.supplier ?? null;
  return {
    id: inv.id,
    kind: inv.kind,
    invoiceNumber: inv.invoiceNumber,
    supplierInvoiceNumber: inv.supplierInvoiceNumber,
    transactionDate: inv.transactionDate,
    totalAmount: inv.totalAmount.toString(),
    netAmount: inv.netAmount.toString(),
    taxAmount: inv.taxAmount.toString(),
    notes: inv.notes,
    supplier,
    expenseLine: inv.expenseLine
      ? {
          nameAr: inv.expenseLine.nameAr,
          nameEn: inv.expenseLine.nameEn ?? undefined,
        }
      : null,
  };
}

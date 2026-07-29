import { Prisma } from '@prisma/client';

export const assetListInclude = {
  supplier: { select: { id: true, nameAr: true, nameEn: true } },
  invoice: { select: { id: true, invoiceNumber: true, supplierInvoiceNumber: true } },
  _count: { select: { warrantyLines: true } },
} satisfies Prisma.CompanyAssetInclude;

export const assetDetailInclude = {
  supplier: { select: { id: true, nameAr: true, nameEn: true } },
  invoice: { select: { id: true, invoiceNumber: true, supplierInvoiceNumber: true } },
  warrantyLines: { orderBy: { sortOrder: 'asc' } },
  _count: { select: { warrantyLines: true } },
} satisfies Prisma.CompanyAssetInclude;

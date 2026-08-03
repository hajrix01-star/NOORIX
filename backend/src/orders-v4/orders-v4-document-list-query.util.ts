import { Prisma } from '@prisma/client';
import type { OrdersV4DocumentType } from './orders-v4.contracts';
import { ordersV4RangeBounds } from './orders-v4-date.util';

export type OrdersV4DocumentListFilters = {
  search?: string;
  sectionId?: string;
  categoryId?: string;
  itemId?: string;
  paymentMethod?: 'custody' | 'cash' | 'transfer';
  status?: 'prepared' | 'received' | 'cancelled' | 'reversed';
};

export function ordersV4DocumentListQuery(
  companyId: string,
  documentType?: OrdersV4DocumentType,
  startDate?: string,
  endDate?: string,
  createdByUserId?: string,
  limit = 250,
  filters: OrdersV4DocumentListFilters = {},
) {
  const search = filters.search?.trim();
  const lineFilter: Prisma.OrdersV4DocumentLineWhereInput = {
    itemId: filters.itemId || undefined,
    item: filters.categoryId ? { categoryId: filters.categoryId } : undefined,
  };
  const hasLineFilter = Boolean(filters.categoryId || filters.itemId);

  return Prisma.validator<Prisma.OrdersV4DocumentFindManyArgs>()({
    where: {
      companyId,
      createdByUserId: createdByUserId || undefined,
      documentType: documentType || undefined,
      sectionId: filters.sectionId || undefined,
      paymentMethod: filters.paymentMethod || undefined,
      status: filters.status || undefined,
      reversalOfId: null,
      documentDate: ordersV4RangeBounds(startDate, endDate),
      lines: hasLineFilter ? { some: lineFilter } : undefined,
      OR: search ? [
        { documentNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { section: { nameAr: { contains: search, mode: 'insensitive' } } },
        { section: { nameEn: { contains: search, mode: 'insensitive' } } },
        { lines: { some: { itemNameSnapshot: { contains: search, mode: 'insensitive' } } } },
        { lines: { some: { item: { nameAr: { contains: search, mode: 'insensitive' } } } } },
        { lines: { some: { item: { nameEn: { contains: search, mode: 'insensitive' } } } } },
        { lines: { some: { item: { sku: { contains: search, mode: 'insensitive' } } } } },
        { lines: { some: { item: { category: { nameAr: { contains: search, mode: 'insensitive' } } } } } },
      ] : undefined,
    },
    include: {
      section: true,
      location: true,
      lines: {
        include: { item: { include: { category: true } }, inputUnit: true, baseUnit: true, priceUnit: true },
        orderBy: { lineNumber: 'asc' },
      },
    },
    orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
    take: Math.max(1, Math.min(2000, limit)),
  });
}

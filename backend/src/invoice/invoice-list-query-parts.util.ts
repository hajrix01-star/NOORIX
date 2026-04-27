import { Prisma } from '@prisma/client';
import { buildInvoiceTransactionDateFilter } from './invoice-transaction-date-filter.util';

export function buildInvoiceListQueryParts({
  companyId,
  page,
  pageSize,
  startDate,
  endDate,
  batchId,
  employeeId,
  kind,
  supplierId,
  categoryId,
  expenseLineId,
  vaultId,
  createdByUserId,
  sortBy,
  sortDir,
  q,
  includeCancelled,
  hasNotes,
  requireExpenseLine,
}: {
  companyId: string;
  page: number;
  pageSize: number;
  startDate?: string;
  endDate?: string;
  batchId?: string;
  employeeId?: string;
  kind?: string;
  supplierId?: string;
  categoryId?: string;
  expenseLineId?: string;
  vaultId?: string;
  createdByUserId?: string;
  sortBy: string;
  sortDir: 'asc' | 'desc' | string;
  q?: string;
  includeCancelled: boolean;
  hasNotes?: string | boolean;
  requireExpenseLine?: boolean;
}): {
  where: Prisma.InvoiceWhereInput;
  orderBy: Prisma.InvoiceOrderByWithRelationInput[];
  size: number;
  p: number;
  aggKey: string;
  activeWhere: Prisma.InvoiceWhereInput;
} {
  const dateFilter = buildInvoiceTransactionDateFilter(startDate, endDate);
  const batchFilter = batchId ? { batchId } : {};
  const employeeFilter = employeeId ? { employeeId } : {};
  const kindFilter = kind ? { kind: { in: kind.split(',').map((k) => k.trim()) } } : {};
  const supplierFilter = supplierId ? { supplierId } : {};
  const categoryFilter = categoryId ? { categoryId } : {};
  const expenseLineFilter = expenseLineId ? { expenseLineId } : {};
  const expenseLinePresenceFilter: Prisma.InvoiceWhereInput =
    requireExpenseLine === true ? { expenseLineId: { not: null } } : {};
  const vaultFilter: Prisma.InvoiceWhereInput = vaultId
    ? {
        OR: [{ vaultId }, { vaultAllocations: { some: { vaultId } } }],
      }
    : {};
  const createdByFilter: Prisma.InvoiceWhereInput =
    createdByUserId === '__none__'
      ? { createdByUserId: null }
      : createdByUserId?.trim()
        ? { createdByUserId: createdByUserId.trim() }
        : {};

  const wantHasNotesOnly =
    hasNotes === true ||
    hasNotes === 'true' ||
    hasNotes === '1' ||
    String(hasNotes || '').toLowerCase() === 'yes';
  const notesPresenceFilter: Prisma.InvoiceWhereInput = wantHasNotesOnly
    ? { AND: [{ notes: { not: null } }, { NOT: { notes: { equals: '' } } }] }
    : {};

  const needle = (q || '').trim().slice(0, 120);
  const searchFilter: Prisma.InvoiceWhereInput =
    needle.length > 0
      ? {
          OR: [
            { invoiceNumber: { contains: needle, mode: 'insensitive' } },
            { supplierInvoiceNumber: { contains: needle, mode: 'insensitive' } },
            { notes: { contains: needle, mode: 'insensitive' } },
            {
              supplier: {
                is: {
                  OR: [
                    { nameAr: { contains: needle, mode: 'insensitive' } },
                    { nameEn: { contains: needle, mode: 'insensitive' } },
                  ],
                },
              },
            },
            {
              employee: {
                is: {
                  OR: [
                    { name: { contains: needle, mode: 'insensitive' } },
                    { nameEn: { contains: needle, mode: 'insensitive' } },
                    { employeeSerial: { contains: needle, mode: 'insensitive' } },
                  ],
                },
              },
            },
            {
              expenseLine: {
                is: {
                  OR: [
                    { nameAr: { contains: needle, mode: 'insensitive' } },
                    { nameEn: { contains: needle, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        }
      : {};

  const where: Prisma.InvoiceWhereInput = {
    companyId,
    ...(includeCancelled ? {} : { status: 'active' }),
    ...dateFilter,
    ...batchFilter,
    ...employeeFilter,
    ...kindFilter,
    ...supplierFilter,
    ...categoryFilter,
    ...expenseLineFilter,
    ...expenseLinePresenceFilter,
    ...vaultFilter,
    ...createdByFilter,
    ...searchFilter,
    ...notesPresenceFilter,
  };

  const dir: Prisma.SortOrder = String(sortDir).toLowerCase() === 'asc' ? 'asc' : 'desc';
  const allowedSort = new Set(['transactionDate', 'createdAt', 'invoiceNumber', 'totalAmount', 'netAmount', 'taxAmount']);
  const primarySortField = allowedSort.has(sortBy) ? sortBy : 'transactionDate';
  const orderBy: Prisma.InvoiceOrderByWithRelationInput[] = [];
  orderBy.push({ [primarySortField]: dir });
  if (primarySortField !== 'transactionDate') {
    orderBy.push({ transactionDate: dir });
  }
  orderBy.push({ createdAt: dir });

  const size = Math.min(200, Math.max(1, pageSize));
  const p = Math.max(1, page);

  const activeWhere: Prisma.InvoiceWhereInput = { ...where, status: 'active' };

  const aggKey = [
    'v1',
    companyId,
    includeCancelled ? '1' : '0',
    String(startDate ?? ''),
    String(endDate ?? ''),
    String(batchId ?? ''),
    String(employeeId ?? ''),
    String(kind ?? ''),
    String(supplierId ?? ''),
    String(categoryId ?? ''),
    String(expenseLineId ?? ''),
    String(vaultId ?? ''),
    String(createdByUserId ?? ''),
    requireExpenseLine === true ? '1' : '0',
    wantHasNotesOnly ? '1' : '0',
    needle,
    String(sortBy),
    String(sortDir),
  ].join('|');

  return { where, orderBy, size, p, aggKey, activeWhere };
}
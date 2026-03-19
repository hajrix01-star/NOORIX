import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: TenantPrismaService) {}

  async findAll(
    companyId: string,
    startDate?: string,
    endDate?: string,
    page = 1,
    pageSize = 50,
    q?: string,
  ) {
    const dateFilter =
      startDate || endDate
        ? {
            transactionDate: {
              ...(startDate ? { gte: new Date(startDate) } : {}),
              ...(endDate   ? { lte: new Date(endDate)   } : {}),
            },
          }
        : {};

    const needle = (q || '').trim().slice(0, 120);
    const searchFilter: Prisma.LedgerEntryWhereInput =
      needle.length > 0
        ? {
            OR: [
              { referenceType: { contains: needle, mode: 'insensitive' } },
              { referenceId: { contains: needle, mode: 'insensitive' } },
              { vault: { is: { nameAr: { contains: needle, mode: 'insensitive' } } } },
              {
                debitAccount: {
                  is: {
                    OR: [
                      { nameAr: { contains: needle, mode: 'insensitive' } },
                      { nameEn: { contains: needle, mode: 'insensitive' } },
                      { code: { contains: needle, mode: 'insensitive' } },
                    ],
                  },
                },
              },
              {
                creditAccount: {
                  is: {
                    OR: [
                      { nameAr: { contains: needle, mode: 'insensitive' } },
                      { nameEn: { contains: needle, mode: 'insensitive' } },
                      { code: { contains: needle, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {};

    const where = { companyId, status: 'active', ...dateFilter, ...searchFilter };
    const size = Math.min(200, Math.max(1, pageSize));
    const p = Math.max(1, page);

    const [items, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { transactionDate: 'desc' },
        skip: (p - 1) * size,
        take: size,
        include: {
          vault: { select: { nameAr: true } },
          debitAccount:  { select: { code: true, nameAr: true, nameEn: true } },
          creditAccount: { select: { code: true, nameAr: true, nameEn: true } },
        },
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return { items, total, page: p, pageSize: size };
  }
}

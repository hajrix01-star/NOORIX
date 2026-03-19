import { Injectable } from '@nestjs/common';
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

    const where = { companyId, status: 'active', ...dateFilter };

    const [items, total] = await Promise.all([
      this.prisma.ledgerEntry.findMany({
        where,
        orderBy: { transactionDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { vault: { select: { nameAr: true } } },
      }),
      this.prisma.ledgerEntry.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }
}

import { Prisma } from '@prisma/client';
import { toYmd } from '../common/utils/to-ymd.util';

export function dailySalesSummaryListInclude(): Prisma.DailySalesSummaryInclude {
  return {
    channels: {
      orderBy: [
        { vault: { sortOrder: 'asc' } },
        { vault: { nameAr: 'asc' } },
      ],
      include: {
        vault: { select: { id: true, nameAr: true, nameEn: true, type: true, paymentMethod: true, sortOrder: true } },
      },
    },
    createdBy: { select: { nameAr: true } },
  };
}

export function salesSummaryDateWhere(
  companyId: string,
  startDate: string,
  endDate: string,
  includeCancelled: boolean,
): Prisma.DailySalesSummaryWhereInput {
  const statusFilter: Prisma.DailySalesSummaryWhereInput = includeCancelled
    ? { status: { in: ['active', 'cancelled'] } }
    : { status: 'active' };
  return {
    companyId,
    ...statusFilter,
    transactionDate: {
      gte: new Date(`${toYmd(startDate)}T00:00:00.000Z`),
      lte: new Date(`${toYmd(endDate)}T23:59:59.999Z`),
    },
  };
}

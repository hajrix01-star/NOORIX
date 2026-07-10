import { Prisma } from '@prisma/client';
import { toYmd } from '../common/utils/to-ymd.util';

export type SalesSummaryShift = 'morning' | 'evening' | 'all';

export function normalizeSalesSummaryShift(value: unknown): SalesSummaryShift {
  if (value === 'morning' || value === 'evening' || value === 'all') return value;
  return 'all';
}

export function buildActiveSalesSummaryShiftDuplicateWhere(params: {
  companyId: string;
  transactionDate: string | Date;
  shift: SalesSummaryShift;
  excludeId?: string | null;
}): Prisma.DailySalesSummaryWhereInput {
  const ymd = toYmd(params.transactionDate);
  const start = new Date(`${ymd}T00:00:00.000Z`);
  const end = new Date(`${ymd}T23:59:59.999Z`);

  return {
    companyId: params.companyId,
    status: 'active',
    shift: params.shift,
    transactionDate: {
      gte: start,
      lte: end,
    },
    ...(params.excludeId ? { NOT: { id: params.excludeId } } : {}),
  };
}

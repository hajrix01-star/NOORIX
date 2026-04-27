import { Decimal } from '@prisma/client/runtime/library';
import { Prisma } from '@prisma/client';

export function buildBankStatementListWhere(
  companyId: string,
  filters?: { month?: string; bankName?: string },
): Record<string, unknown> {
  const where: Record<string, unknown> = { companyId };
  if (filters?.month) {
    where.OR = [
      { startDate: { startsWith: filters.month } },
      { endDate: { startsWith: filters.month } },
    ];
  }
  if (filters?.bankName?.trim()) {
    where.bankName = { contains: filters.bankName.trim(), mode: 'insensitive' };
  }
  return where;
}

type BankStmtAgg = {
  _count: { id: number };
  _sum: { totalDeposits: Prisma.Decimal | null; totalWithdrawals: Prisma.Decimal | null };
};

export function formatBankStatementSummary(agg: BankStmtAgg) {
  const deposits = agg._sum.totalDeposits ?? new Decimal(0);
  const withdrawals = agg._sum.totalWithdrawals ?? new Decimal(0);
  const net = deposits.sub(withdrawals);
  return {
    statementCount: agg._count.id,
    totalDeposits: deposits.toString(),
    totalWithdrawals: withdrawals.toString(),
    netFlow: net.toString(),
  };
}

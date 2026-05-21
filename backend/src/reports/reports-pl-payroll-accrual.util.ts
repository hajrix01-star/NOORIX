import Decimal from 'decimal.js';
import { KIND_LABELS, type GroupKey } from './reports-general-profit-loss-model.util';
import { plDec } from './reports-pl-math.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type PlLedgerAggregateEntry = {
  groupKey: GroupKey | null;
  monthIndex: number;
  amount: Decimal;
  itemKey: string;
  labelAr: string;
  labelEn: string;
  sortOrder: number;
};

/**
 * مسيرات رواتب «مكتملة» بدون فاتورة salary نشطة — تُخصم من المصروفات/صافي الربح
 * في شهر المسيرة حتى يتم صرفها (عندها تُحسب من القيود فقط لتجنب الازدواج).
 */
export async function loadCompletedUnpaidPayrollPlEntries(
  prisma: TenantPrismaService,
  companyId: string,
  year: number,
): Promise<PlLedgerAggregateEntry[]> {
  const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

  const [runs, paidSalaryInvoices] = await Promise.all([
    prisma.payrollRun.findMany({
      where: {
        companyId,
        status: 'completed',
        payrollMonth: { gte: yearStart, lte: yearEnd },
      },
      select: { id: true, totalAmount: true, payrollMonth: true },
    }),
    prisma.invoice.findMany({
      where: {
        companyId,
        kind: 'salary',
        status: 'active',
        batchId: { not: null },
      },
      select: { batchId: true },
    }),
  ]);

  const paidRunIds = new Set(
    paidSalaryInvoices.map((inv) => inv.batchId).filter((id): id is string => id != null),
  );

  const { ar, en } = KIND_LABELS.salary;

  return runs
    .filter((run) => !paidRunIds.has(run.id))
    .map((run) => ({
      groupKey: 'expenses' as const,
      monthIndex: run.payrollMonth.getUTCMonth(),
      amount: plDec(String(run.totalAmount)),
      itemKey: 'kind:salary',
      labelAr: ar,
      labelEn: en,
      sortOrder: 999999,
    }));
}

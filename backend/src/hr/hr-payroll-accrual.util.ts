import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { reportingClassForReferenceType } from '../financial-core/financial-reporting-classification.util';
import { applyPayrollAdvanceSettlements } from './hr-payroll-advance-settlement.util';
import { toYmd } from '../common/utils/to-ymd.util';

export type PayrollAccrualTx = Prisma.TransactionClient;

export type PayrollRunForAccrual = {
  id: string;
  companyId: string;
  runNumber: string;
  payrollMonth: Date;
  totalAmount: Prisma.Decimal;
  items: Array<{
    employeeId: string;
    netSalary: Prisma.Decimal;
    advancesDeduct: Prisma.Decimal | null;
    advanceSelections?: Prisma.JsonValue | null;
    employee: { name: string | null } | null;
  }>;
};

export function payrollAccrualDate(payrollMonth: Date): Date {
  return new Date(Date.UTC(
    payrollMonth.getUTCFullYear(),
    payrollMonth.getUTCMonth() + 1,
    0,
    0,
    0,
    0,
    0,
  ));
}

export async function postPayrollAccrualInTransaction(
  tx: PayrollAccrualTx,
  fiscalPeriod: FiscalPeriodService,
  run: PayrollRunForAccrual,
  tenantId: string,
  userId?: string,
): Promise<{ expense: Prisma.Decimal; payable: Prisma.Decimal; advances: Prisma.Decimal; idempotentReplay: boolean }> {
  const existing = await tx.ledgerEntry.findFirst({
    where: {
      companyId: run.companyId,
      referenceType: 'payroll_accrual',
      referenceId: run.id,
      status: 'active',
    },
    select: { id: true },
  });
  const payable = new Prisma.Decimal(run.totalAmount);
  const advances = run.items.reduce(
    (sum, item) => sum.plus(new Prisma.Decimal(item.advancesDeduct ?? 0)),
    new Prisma.Decimal(0),
  );
  const expense = payable.plus(advances);
  if (existing) return { expense, payable, advances, idempotentReplay: true };

  const transactionDate = payrollAccrualDate(run.payrollMonth);
  await fiscalPeriod.assertPeriodOpenForDate(tx, run.companyId, transactionDate);

  const [salaryExpense, payrollPayable, advanceAsset] = await Promise.all([
    tx.account.findFirst({
      where: { companyId: run.companyId, code: 'EXP-004', type: 'expense', isActive: true },
      select: { id: true },
    }),
    tx.account.findFirst({
      where: { companyId: run.companyId, code: 'PAY-001', type: 'liability', isActive: true },
      select: { id: true },
    }),
    advances.isZero()
      ? Promise.resolve(null)
      : tx.account.findFirst({
          where: { companyId: run.companyId, code: 'ADV-001', type: 'asset', isActive: true },
          select: { id: true },
        }),
  ]);
  if (!salaryExpense || !payrollPayable || (!advances.isZero() && !advanceAsset)) {
    throw new BadRequestException('Required payroll ledger accounts are not configured for this company.');
  }

  const settledAdvances = await applyPayrollAdvanceSettlements(
    tx,
    run,
    toYmd(transactionDate),
    tenantId,
    { postExpenseLedger: false },
  );
  if (settledAdvances.minus(advances).abs().gt(0.02)) {
    throw new BadRequestException('The settled employee advances do not match the payroll deduction total. Refresh the run and try again.');
  }

  for (const item of run.items) {
    const netSalary = new Prisma.Decimal(item.netSalary);
    const advanceDeduct = new Prisma.Decimal(item.advancesDeduct ?? 0);
    if (netSalary.gt(0)) {
      await tx.ledgerEntry.create({
        data: {
          tenantId,
          companyId: run.companyId,
          debitAccountId: salaryExpense.id,
          creditAccountId: payrollPayable.id,
          amount: netSalary,
          transactionDate,
          entryDate: new Date(),
          referenceType: 'payroll_accrual',
          referenceId: run.id,
          reportingClass: reportingClassForReferenceType('payroll_accrual'),
          employeeId: item.employeeId,
          createdById: userId,
          status: 'active',
        },
      });
    }
    if (advanceDeduct.gt(0) && advanceAsset) {
      await tx.ledgerEntry.create({
        data: {
          tenantId,
          companyId: run.companyId,
          debitAccountId: salaryExpense.id,
          creditAccountId: advanceAsset.id,
          amount: advanceDeduct,
          transactionDate,
          entryDate: new Date(),
          referenceType: 'payroll_accrual',
          referenceId: run.id,
          reportingClass: reportingClassForReferenceType('payroll_accrual'),
          employeeId: item.employeeId,
          createdById: userId,
          status: 'active',
        },
      });
    }
  }

  return { expense, payable, advances, idempotentReplay: false };
}

import { Prisma } from '@prisma/client';
import { reportingClassForReferenceType } from './financial-reporting-classification.util';

export type PayrollAccrualLedgerLine = {
  employeeId: string;
  creditAccountId: string;
  amount: Prisma.Decimal;
};

export type PayrollAccrualLedgerInput = {
  tenantId: string;
  companyId: string;
  payrollRunId: string;
  salaryExpenseAccountId: string;
  transactionDate: Date;
  createdById?: string;
  lines: PayrollAccrualLedgerLine[];
};

export async function postPayrollAccrualLedgerInTransaction(
  tx: Prisma.TransactionClient,
  input: PayrollAccrualLedgerInput,
): Promise<void> {
  const entryDate = new Date();
  for (const line of input.lines) {
    if (line.amount.lte(0)) continue;
    await tx.ledgerEntry.create({
      data: {
        tenantId: input.tenantId,
        companyId: input.companyId,
        debitAccountId: input.salaryExpenseAccountId,
        creditAccountId: line.creditAccountId,
        amount: line.amount,
        transactionDate: input.transactionDate,
        entryDate,
        referenceType: 'payroll_accrual',
        referenceId: input.payrollRunId,
        reportingClass: reportingClassForReferenceType('payroll_accrual'),
        employeeId: line.employeeId,
        createdById: input.createdById,
        status: 'active',
      },
    });
  }
}

export function cancelPayrollAccrualLedgerInTransaction(
  tx: Prisma.TransactionClient,
  companyId: string,
  payrollRunId: string,
) {
  return tx.ledgerEntry.updateMany({
    where: {
      companyId,
      referenceType: 'payroll_accrual',
      referenceId: payrollRunId,
      status: 'active',
    },
    data: { status: 'cancelled' },
  });
}

/**
 * Governed writer for a previously proven set of non-cash legacy payroll
 * advance duplicates. Eligibility is established by the HR reconciliation
 * service; this accounting boundary still constrains the mutation to the
 * expected ledger shape and company.
 */
export function cancelProvenPayrollLegacyLedgerRowsInTransaction(
  tx: Prisma.TransactionClient,
  companyId: string,
  ledgerEntryIds: string[],
) {
  return tx.ledgerEntry.updateMany({
    where: {
      companyId,
      id: { in: ledgerEntryIds },
      status: 'active',
      referenceType: 'advance_settlement',
      vaultId: null,
      debitAccount: { code: 'EXP-004' },
      creditAccount: { code: 'ADV-001' },
    },
    data: { status: 'cancelled' },
  });
}

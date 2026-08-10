/**
 * إعادة بناء قيود الصرف وتخصيصات الخزنة — مستخرج من FinancialOutflowService لتقليل حجم الملف (ميثاق ≤450 سطر حيث ينطبق).
 */
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { validateJournalBalance } from './financial-core-helpers.util';
import type { TxClient } from './financial-core-helpers.util';
import type { LedgerReportingClass } from './financial-reporting-classification.util';

export type OutflowLedgerInvoiceSlice = {
  tenantId: string;
  id: string;
  transactionDate: Date;
  employeeId: string | null;
  totalAmount: Prisma.Decimal;
};

/** توزيع نسبي للمبالغ على الخزائن عند تعدد التخصيصات بعد تغيير إجمالي الفاتورة */
export function scaleVaultAllocationsToTotal(
  rows: Array<{ vaultId: string; amount: Prisma.Decimal }>,
  newTotal: Prisma.Decimal,
): Array<{ vaultId: string; amount: Prisma.Decimal }> {
  if (rows.length === 0) {
    return [];
  }
  if (rows.length === 1) {
    return [{ vaultId: rows[0].vaultId, amount: newTotal }];
  }
  const oldSum = rows.reduce((acc, r) => acc.plus(r.amount), new Prisma.Decimal(0));
  if (oldSum.lte(0)) {
    throw new BadRequestException('مجموع تخصيصات الخزنة السابقة غير صالح لتعديل المبلغ.');
  }
  const result: Array<{ vaultId: string; amount: Prisma.Decimal }> = [];
  let acc = new Prisma.Decimal(0);
  for (let i = 0; i < rows.length; i++) {
    if (i === rows.length - 1) {
      result.push({ vaultId: rows[i].vaultId, amount: newTotal.minus(acc) });
    } else {
      const raw = rows[i].amount.mul(newTotal).div(oldSum);
      const rounded = new Prisma.Decimal(raw.toFixed(4));
      result.push({ vaultId: rows[i].vaultId, amount: rounded });
      acc = acc.plus(rounded);
    }
  }
  return result;
}

export async function replaceOutflowInvoiceLedgerAndAllocations(
  tx: TxClient,
  companyId: string,
  inv: OutflowLedgerInvoiceSlice,
  invoiceId: string,
  splits: Array<{ vaultId: string; amount: Prisma.Decimal }>,
  debitAccountId: string,
  entryDate: Date,
  referenceType: string,
  reportingClass: LedgerReportingClass,
  userId: string,
  getVaultAccount: (t: TxClient, cid: string, vaultId: string) => Promise<string>,
): Promise<void> {
  await tx.invoiceVaultAllocation.deleteMany({ where: { invoiceId } });
  await tx.ledgerEntry.deleteMany({
    where: {
      companyId,
      referenceId: invoiceId,
      referenceType: { in: ['invoice', 'salary', 'advance'] },
      status: 'active',
    },
  });

  validateJournalBalance(
    [{ amount: inv.totalAmount }],
    splits.map((s) => ({ amount: s.amount })),
  );
  for (const split of splits) {
    const creditAccountId = await getVaultAccount(tx, companyId, split.vaultId);
    await tx.ledgerEntry.create({
      data: {
        tenantId: inv.tenantId,
        companyId,
        debitAccountId,
        creditAccountId,
        amount: split.amount,
        transactionDate: inv.transactionDate,
        entryDate,
        referenceType,
        referenceId: invoiceId,
        reportingClass,
        vaultId: split.vaultId,
        employeeId: inv.employeeId ?? null,
        createdById: userId,
        status: 'active',
      },
    });

    await tx.invoiceVaultAllocation.create({
      data: {
        tenantId: inv.tenantId,
        invoiceId: inv.id,
        vaultId: split.vaultId,
        amount: split.amount,
      },
    });
  }
}

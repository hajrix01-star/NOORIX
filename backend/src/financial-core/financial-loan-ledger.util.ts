/**
 * القيد المركزي للقروض: لا تكتب وحدة القروض في دفتر الأستاذ مباشرة.
 * يبقى سجل القرض ودفعاته في وحدته التشغيلية، بينما كل الأثر المحاسبي
 * يمر من هذه الطبقة مثل التحويلات والصرف المالي.
 */
import { Prisma } from '@prisma/client';
import type { TxClient } from './financial-core-helpers.util';

type LoanLedgerBase = {
  tenantId: string;
  companyId: string;
  amount: Prisma.Decimal;
  transactionDate: Date;
  entryDate: Date;
  referenceId: string;
  createdById: string;
};

export function postLoanOpeningLedger(
  tx: TxClient,
  data: LoanLedgerBase & { openingBalanceAccountId: string; loanAccountId: string },
) {
  return tx.ledgerEntry.create({
    data: {
      tenantId: data.tenantId,
      companyId: data.companyId,
      debitAccountId: data.openingBalanceAccountId,
      creditAccountId: data.loanAccountId,
      amount: data.amount,
      transactionDate: data.transactionDate,
      entryDate: data.entryDate,
      referenceType: 'loan_opening',
      referenceId: data.referenceId,
      createdById: data.createdById,
    },
  });
}

export function postLoanPaymentLedger(
  tx: TxClient,
  data: LoanLedgerBase & { loanAccountId: string; vaultAccountId: string; vaultId: string },
) {
  return tx.ledgerEntry.create({
    data: {
      tenantId: data.tenantId,
      companyId: data.companyId,
      debitAccountId: data.loanAccountId,
      creditAccountId: data.vaultAccountId,
      amount: data.amount,
      transactionDate: data.transactionDate,
      entryDate: data.entryDate,
      referenceType: 'loan_payment',
      referenceId: data.referenceId,
      vaultId: data.vaultId,
      createdById: data.createdById,
    },
  });
}

export function postLoanPaymentReversalLedger(
  tx: TxClient,
  data: LoanLedgerBase & { loanAccountId: string; vaultAccountId: string; vaultId: string },
) {
  return tx.ledgerEntry.create({
    data: {
      tenantId: data.tenantId,
      companyId: data.companyId,
      debitAccountId: data.vaultAccountId,
      creditAccountId: data.loanAccountId,
      amount: data.amount,
      transactionDate: data.transactionDate,
      entryDate: data.entryDate,
      referenceType: 'loan_payment_reversal',
      referenceId: data.referenceId,
      vaultId: data.vaultId,
      createdById: data.createdById,
    },
  });
}

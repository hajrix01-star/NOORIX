/**
 * القيد المركزي للقروض: لا تكتب وحدة القروض في دفتر الأستاذ مباشرة.
 * يبقى سجل القرض ودفعاته في وحدته التشغيلية، بينما كل الأثر المحاسبي
 * يمر من هذه الطبقة مثل التحويلات والصرف المالي.
 */
import { Prisma } from '@prisma/client';
import type { TxClient } from './financial-core-helpers.util';
import { reportingClassForReferenceType } from './financial-reporting-classification.util';

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
      reportingClass: reportingClassForReferenceType('loan_opening'),
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
      reportingClass: reportingClassForReferenceType('loan_payment'),
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
      reportingClass: reportingClassForReferenceType('loan_payment_reversal'),
      vaultId: data.vaultId,
      createdById: data.createdById,
    },
  });
}

/**
 * إعادة تصنيف أقساط مسجلة سابقاً كمصروف: تلغي الأثر المحاسبي القديم فقط
 * (مع بقاء المستند في السجل) وتسمح لخدمة القروض بإنشاء البديل في المعاملة نفسها.
 */
export async function cancelLegacyLoanExpenseInvoices(
  tx: TxClient,
  companyId: string,
  invoiceIds: string[],
  ledgerEntryIds: string[],
) {
  await tx.invoice.updateMany({
    where: { id: { in: invoiceIds }, companyId, status: 'active' },
    data: { status: 'cancelled' },
  });
  await tx.ledgerEntry.updateMany({
    where: { id: { in: ledgerEntryIds }, companyId, status: 'active' },
    data: { status: 'cancelled' },
  });
}

/** يستبدل قيد افتتاح القرض بسجل فعال واحد متوافق مع الرصيد بعد إعادة التصنيف. */
export async function replaceLoanOpeningLedger(
  tx: TxClient,
  originalLedgerId: string,
  data: LoanLedgerBase & { openingBalanceAccountId: string; loanAccountId: string },
) {
  await tx.ledgerEntry.update({ where: { id: originalLedgerId }, data: { status: 'cancelled' } });
  return postLoanOpeningLedger(tx, data);
}

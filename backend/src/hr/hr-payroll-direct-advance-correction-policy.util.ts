import { createHash } from 'crypto';

export type DirectAdvancePayrollDuplicateCandidate = {
  ledgerEntryId: string;
  advanceInvoiceId: string;
  advanceInvoiceNumber: string;
  employeeId: string;
  sourceRunId: string;
  sourceRunNumber: string;
  sourcePayrollItemId: string;
  invoiceAmount: number;
  payrollItemAdvanceDeduct: number;
  transactionDate: Date;
  amount: number;
  status: string;
  referenceType: string;
  debitAccountCode: string;
  creditAccountCode: string;
  vaultId: string | null;
};

export type DirectAdvancePayrollDuplicatePreview = {
  correctionMode: 'direct_advance_invoice';
  targetMonth: string;
  ledgerPayrollCostBefore: number;
  expectedPayrollCost: number;
  selectedLegacyTotal: number;
  ledgerPayrollCostAfter: number;
  differenceBefore: number;
  differenceAfter: number;
  ledgerEntryIds: string[];
  previewHash: string;
};

const rounded = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const monthKey = (value: Date) => value.toISOString().slice(0, 7);

/**
 * Fail closed proof for a legacy advance posted directly as payroll cost.
 * The same advance must be explicitly tied to one completed payroll item and
 * be the whole advance deduction of that item.  It is never a cash reversal.
 */
export function buildDirectAdvancePayrollDuplicatePreview(input: {
  companyId: string;
  targetMonth: string;
  sourceRunNumber: string;
  expectedPayrollCost: number;
  ledgerPayrollCost: number;
  candidates: DirectAdvancePayrollDuplicateCandidate[];
}): DirectAdvancePayrollDuplicatePreview {
  const ids = new Set<string>();
  for (const row of input.candidates) {
    if (!row.ledgerEntryId || ids.has(row.ledgerEntryId)) throw new Error('DUPLICATE_LEDGER_ENTRY_ID');
    ids.add(row.ledgerEntryId);
    if (row.status !== 'active') throw new Error('LEGACY_LEDGER_NOT_ACTIVE');
    if (monthKey(row.transactionDate) !== input.targetMonth) throw new Error('LEGACY_LEDGER_OUTSIDE_TARGET_MONTH');
    if (row.referenceType !== 'invoice') throw new Error('NOT_DIRECT_ADVANCE_INVOICE_LEDGER');
    if (row.debitAccountCode !== 'EXP-004' || row.creditAccountCode !== 'ADV-001') {
      throw new Error('UNEXPECTED_LEDGER_ACCOUNTS');
    }
    if (row.vaultId) throw new Error('CASH_AFFECTING_LEDGER_REJECTED');
    if (!row.advanceInvoiceId || !row.advanceInvoiceNumber || !row.employeeId) throw new Error('MISSING_ADVANCE_PROOF');
    if (row.sourceRunNumber !== input.sourceRunNumber || !row.sourceRunId || !row.sourcePayrollItemId) {
      throw new Error('SOURCE_PAYROLL_RUN_MISMATCH');
    }
    if (
      !Number.isFinite(row.amount)
      || row.amount <= 0
      || Math.abs(row.amount - row.invoiceAmount) > 0.02
      || Math.abs(row.amount - row.payrollItemAdvanceDeduct) > 0.02
    ) throw new Error('ADVANCE_AMOUNT_DOES_NOT_EXACTLY_MATCH_PAYROLL_ITEM');
  }

  if (!input.candidates.length) throw new Error('NO_PROVEN_DIRECT_ADVANCE_DUPLICATES');
  const selectedLegacyTotal = rounded(input.candidates.reduce((sum, row) => sum + row.amount, 0));
  const differenceBefore = rounded(input.ledgerPayrollCost - input.expectedPayrollCost);
  const ledgerPayrollCostAfter = rounded(input.ledgerPayrollCost - selectedLegacyTotal);
  const differenceAfter = rounded(ledgerPayrollCostAfter - input.expectedPayrollCost);
  if (
    Math.abs(selectedLegacyTotal - differenceBefore) > 0.02
    || Math.abs(differenceAfter) > 0.02
  ) throw new Error('SELECTED_ROWS_DO_NOT_EXACTLY_RECONCILE_PAYROLL');

  const ledgerEntryIds = [...ids].sort();
  const fingerprint = JSON.stringify({
    companyId: input.companyId,
    correctionMode: 'direct_advance_invoice',
    targetMonth: input.targetMonth,
    sourceRunNumber: input.sourceRunNumber,
    expectedPayrollCost: rounded(input.expectedPayrollCost),
    ledgerPayrollCost: rounded(input.ledgerPayrollCost),
    candidates: input.candidates.map((row) => ({
      id: row.ledgerEntryId,
      advanceInvoiceId: row.advanceInvoiceId,
      advanceInvoiceNumber: row.advanceInvoiceNumber,
      employeeId: row.employeeId,
      sourceRunId: row.sourceRunId,
      sourceRunNumber: row.sourceRunNumber,
      sourcePayrollItemId: row.sourcePayrollItemId,
      amount: rounded(row.amount),
      invoiceAmount: rounded(row.invoiceAmount),
      payrollItemAdvanceDeduct: rounded(row.payrollItemAdvanceDeduct),
      date: row.transactionDate.toISOString(),
    })).sort((a, b) => a.id.localeCompare(b.id)),
  });

  return {
    correctionMode: 'direct_advance_invoice',
    targetMonth: input.targetMonth,
    ledgerPayrollCostBefore: rounded(input.ledgerPayrollCost),
    expectedPayrollCost: rounded(input.expectedPayrollCost),
    selectedLegacyTotal,
    ledgerPayrollCostAfter,
    differenceBefore,
    differenceAfter,
    ledgerEntryIds,
    previewHash: createHash('sha256').update(fingerprint).digest('hex'),
  };
}

import { createHash } from 'crypto';

export type LegacyPayrollCorrectionCandidate = {
  ledgerEntryId: string;
  deductionId: string;
  deductionNotes: string;
  employeeId: string;
  advanceInvoiceId: string;
  advanceInvoiceNumber: string;
  sourceRunId: string;
  sourceRunNumber: string;
  sourcePayrollItemId: string;
  documentedRepairLedgerEntryId: string;
  documentedRepairDeductionId: string;
  documentedRepairAmount: number;
  transactionDate: Date;
  amount: number;
  status: string;
  referenceType: string;
  debitAccountCode: string;
  creditAccountCode: string;
  vaultId: string | null;
  structuredSettlementId: string | null;
  documentedHistoricalRepair: boolean;
};

export type LegacyPayrollCorrectionPreview = {
  correctionMode: 'full' | 'proven_subset';
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
 * Pure fail-closed policy used before wiring the owner-only correction endpoint.
 * It never reads or mutates the database.
 */
export function buildLegacyPayrollCorrectionPreview(input: {
  companyId: string;
  targetMonth: string;
  sourceRunNumber: string;
  expectedPayrollCost: number;
  ledgerPayrollCost: number;
  candidates: LegacyPayrollCorrectionCandidate[];
  allowResidual?: boolean;
}): LegacyPayrollCorrectionPreview {
  const ids = new Set<string>();
  const documentedRepairOwners = new Map<string, string>();
  const employeeProof = new Map<string, {
    selected: number;
    repairAmount: number;
    repairLedgerId: string;
    repairDeductionId: string;
    payrollItemId: string;
  }>();
  for (const row of input.candidates) {
    if (!row.ledgerEntryId || ids.has(row.ledgerEntryId)) throw new Error('DUPLICATE_LEDGER_ENTRY_ID');
    ids.add(row.ledgerEntryId);
    if (row.status !== 'active') throw new Error('LEGACY_LEDGER_NOT_ACTIVE');
    if (monthKey(row.transactionDate) !== input.targetMonth) throw new Error('LEGACY_LEDGER_OUTSIDE_TARGET_MONTH');
    if (row.referenceType !== 'advance_settlement') throw new Error('NOT_ADVANCE_SETTLEMENT_LEDGER');
    if (row.debitAccountCode !== 'EXP-004' || row.creditAccountCode !== 'ADV-001') {
      throw new Error('UNEXPECTED_LEDGER_ACCOUNTS');
    }
    if (row.vaultId) throw new Error('CASH_AFFECTING_LEDGER_REJECTED');
    if (row.structuredSettlementId) throw new Error('STRUCTURED_SETTLEMENT_REJECTED');
    if (row.documentedHistoricalRepair) throw new Error('DOCUMENTED_REPAIR_REJECTED');
    if (!Number.isFinite(row.amount) || row.amount <= 0) throw new Error('INVALID_LEDGER_AMOUNT');
    if (!row.deductionId || !row.advanceInvoiceId || !row.advanceInvoiceNumber) {
      throw new Error('MISSING_ADVANCE_PROOF');
    }
    if (row.sourceRunNumber !== input.sourceRunNumber || !row.sourceRunId || !row.sourcePayrollItemId) {
      throw new Error('SOURCE_PAYROLL_RUN_MISMATCH');
    }
    if (!row.deductionNotes.includes(input.sourceRunNumber) || !row.deductionNotes.includes(row.advanceInvoiceNumber)) {
      throw new Error('LEGACY_DEDUCTION_NOTE_MISMATCH');
    }
    if (!row.documentedRepairLedgerEntryId || !row.documentedRepairDeductionId || row.documentedRepairAmount <= 0) {
      throw new Error('MISSING_DOCUMENTED_REPAIR_PROOF');
    }

    const repairOwner = documentedRepairOwners.get(row.documentedRepairLedgerEntryId);
    if (repairOwner && repairOwner !== row.employeeId) throw new Error('DOCUMENTED_REPAIR_REUSED');
    documentedRepairOwners.set(row.documentedRepairLedgerEntryId, row.employeeId);
    const proof = employeeProof.get(row.employeeId);
    if (proof && (
      proof.repairLedgerId !== row.documentedRepairLedgerEntryId
      || proof.repairDeductionId !== row.documentedRepairDeductionId
      || proof.payrollItemId !== row.sourcePayrollItemId
      || Math.abs(proof.repairAmount - row.documentedRepairAmount) > 0.02
    )) throw new Error('MULTIPLE_DOCUMENTED_REPAIR_SETS');
    employeeProof.set(row.employeeId, {
      selected: rounded((proof?.selected ?? 0) + row.amount),
      repairAmount: row.documentedRepairAmount,
      repairLedgerId: row.documentedRepairLedgerEntryId,
      repairDeductionId: row.documentedRepairDeductionId,
      payrollItemId: row.sourcePayrollItemId,
    });
  }

  for (const proof of employeeProof.values()) {
    if (Math.abs(proof.selected - proof.repairAmount) > 0.02) {
      throw new Error('EMPLOYEE_TOTAL_DOES_NOT_MATCH_DOCUMENTED_REPAIR');
    }
  }

  const selectedLegacyTotal = rounded(input.candidates.reduce((sum, row) => sum + row.amount, 0));
  const differenceBefore = rounded(input.ledgerPayrollCost - input.expectedPayrollCost);
  const ledgerPayrollCostAfter = rounded(input.ledgerPayrollCost - selectedLegacyTotal);
  const differenceAfter = rounded(ledgerPayrollCostAfter - input.expectedPayrollCost);
  const correctionMode = input.allowResidual ? 'proven_subset' : 'full';
  if (input.allowResidual) {
    if (
      differenceBefore <= 0.02
      || selectedLegacyTotal <= 0.02
      || selectedLegacyTotal - differenceBefore > 0.02
      || differenceAfter < -0.02
    ) {
      throw new Error('PROVEN_SUBSET_DOES_NOT_REDUCE_POSITIVE_PAYROLL_DIFFERENCE');
    }
  } else if (Math.abs(selectedLegacyTotal - differenceBefore) > 0.02 || Math.abs(differenceAfter) > 0.02) {
    throw new Error('SELECTED_ROWS_DO_NOT_EXACTLY_RECONCILE_PAYROLL');
  }

  const ledgerEntryIds = [...ids].sort();
  const fingerprint = JSON.stringify({
    companyId: input.companyId,
    correctionMode,
    targetMonth: input.targetMonth,
    sourceRunNumber: input.sourceRunNumber,
    expectedPayrollCost: rounded(input.expectedPayrollCost),
    ledgerPayrollCost: rounded(input.ledgerPayrollCost),
    candidates: input.candidates
      .map((row) => ({
        id: row.ledgerEntryId,
        deductionId: row.deductionId,
        deductionNotes: row.deductionNotes,
        employeeId: row.employeeId,
        advanceInvoiceId: row.advanceInvoiceId,
        advanceInvoiceNumber: row.advanceInvoiceNumber,
        sourceRunId: row.sourceRunId,
        sourceRunNumber: row.sourceRunNumber,
        sourcePayrollItemId: row.sourcePayrollItemId,
        documentedRepairLedgerEntryId: row.documentedRepairLedgerEntryId,
        documentedRepairDeductionId: row.documentedRepairDeductionId,
        documentedRepairAmount: rounded(row.documentedRepairAmount),
        amount: rounded(row.amount),
        date: row.transactionDate.toISOString(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });

  return {
    correctionMode,
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

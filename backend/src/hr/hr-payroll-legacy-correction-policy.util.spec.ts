import { buildLegacyPayrollCorrectionPreview, type LegacyPayrollCorrectionCandidate } from './hr-payroll-legacy-correction-policy.util';

const candidate = (overrides: Partial<LegacyPayrollCorrectionCandidate> = {}): LegacyPayrollCorrectionCandidate => ({
  ledgerEntryId: 'ledger-1', deductionId: 'deduction-1', employeeId: 'employee-1',
  deductionNotes: 'Payroll PR-2607-001 advance ADV-001',
  advanceInvoiceId: 'advance-1', advanceInvoiceNumber: 'ADV-001',
  sourceRunId: 'run-1', sourceRunNumber: 'PR-2607-001', sourcePayrollItemId: 'item-1',
  documentedRepairLedgerEntryId: 'repair-ledger-1', documentedRepairDeductionId: 'repair-deduction-1',
  documentedRepairAmount: 13100,
  transactionDate: new Date('2026-07-06T00:00:00.000Z'), amount: 13100,
  status: 'active', referenceType: 'advance_settlement', debitAccountCode: 'EXP-004',
  creditAccountCode: 'ADV-001', vaultId: null, structuredSettlementId: null,
  documentedHistoricalRepair: false, ...overrides,
});

describe('legacy payroll correction policy', () => {
  it('previews the exact July correction without mutating the input', () => {
    const rows = [candidate()];
    const before = JSON.stringify(rows);
    const result = buildLegacyPayrollCorrectionPreview({
      companyId: 'shami', targetMonth: '2026-07', sourceRunNumber: 'PR-2607-001', expectedPayrollCost: 48051,
      ledgerPayrollCost: 61151, candidates: rows,
    });
    expect(result).toMatchObject({
      selectedLegacyTotal: 13100, ledgerPayrollCostBefore: 61151,
      ledgerPayrollCostAfter: 48051, differenceBefore: 13100, differenceAfter: 0,
      ledgerEntryIds: ['ledger-1'],
    });
    expect(result.previewHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(rows)).toBe(before);
  });

  it.each([
    ['structured row', { structuredSettlementId: 'settlement-1' }],
    ['documented repair', { documentedHistoricalRepair: true }],
    ['cash-linked row', { vaultId: 'vault-1' }],
    ['wrong month', { transactionDate: new Date('2026-08-01T00:00:00.000Z') }],
    ['wrong accounts', { creditAccountCode: 'PAY-001' }],
  ])('rejects %s', (_label, overrides) => {
    expect(() => buildLegacyPayrollCorrectionPreview({
      companyId: 'shami', targetMonth: '2026-07', sourceRunNumber: 'PR-2607-001', expectedPayrollCost: 48051,
      ledgerPayrollCost: 61151, candidates: [candidate(overrides)],
    })).toThrow();
  });

  it('rejects a partial or excessive selection', () => {
    expect(() => buildLegacyPayrollCorrectionPreview({
      companyId: 'shami', targetMonth: '2026-07', sourceRunNumber: 'PR-2607-001', expectedPayrollCost: 48051,
      ledgerPayrollCost: 61151, candidates: [candidate({ amount: 12000, documentedRepairAmount: 12000 })],
    })).toThrow('SELECTED_ROWS_DO_NOT_EXACTLY_RECONCILE_PAYROLL');
  });

  it('accepts only a proved subset while preserving the month residual for review', () => {
    const result = buildLegacyPayrollCorrectionPreview({
      companyId: 'shami', targetMonth: '2026-05', sourceRunNumber: 'PR-2605-001', expectedPayrollCost: 48051,
      ledgerPayrollCost: 59816, candidates: [candidate({
        amount: 9500,
        documentedRepairAmount: 9500,
        transactionDate: new Date('2026-05-04T00:00:00.000Z'),
        sourceRunNumber: 'PR-2605-001',
        deductionNotes: 'Payroll PR-2605-001 advance ADV-001',
      })],
      allowResidual: true,
    });
    expect(result).toMatchObject({
      correctionMode: 'proven_subset',
      selectedLegacyTotal: 9500,
      differenceBefore: 11765,
      differenceAfter: 2265,
    });
  });

  it('rejects a legacy deduction that is not explicitly linked to the run and advance invoice', () => {
    expect(() => buildLegacyPayrollCorrectionPreview({
      companyId: 'shami', targetMonth: '2026-07', sourceRunNumber: 'PR-2607-001', expectedPayrollCost: 48051,
      ledgerPayrollCost: 61151, candidates: [candidate({ deductionNotes: 'generic legacy deduction' })],
    })).toThrow('LEGACY_DEDUCTION_NOTE_MISMATCH');
  });

  it('rejects a per-employee total that differs from the documented repair', () => {
    expect(() => buildLegacyPayrollCorrectionPreview({
      companyId: 'shami', targetMonth: '2026-07', sourceRunNumber: 'PR-2607-001', expectedPayrollCost: 48051,
      ledgerPayrollCost: 61151, candidates: [candidate({ documentedRepairAmount: 13099 })],
    })).toThrow('EMPLOYEE_TOTAL_DOES_NOT_MATCH_DOCUMENTED_REPAIR');
  });
});

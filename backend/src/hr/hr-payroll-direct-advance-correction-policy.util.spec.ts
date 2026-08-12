import { buildDirectAdvancePayrollDuplicatePreview } from './hr-payroll-direct-advance-correction-policy.util';

const base = {
  companyId: 'company-1', targetMonth: '2026-05', sourceRunNumber: 'PR-2606-001',
  expectedPayrollCost: 48091, ledgerPayrollCost: 49091,
  candidates: [{
    ledgerEntryId: 'ledger-1', advanceInvoiceId: 'advance-1', advanceInvoiceNumber: 'ADV-001',
    employeeId: 'employee-1', sourceRunId: 'run-1', sourceRunNumber: 'PR-2606-001', sourcePayrollItemId: 'item-1',
    invoiceAmount: 1000, payrollItemAdvanceDeduct: 1000, transactionDate: new Date('2026-05-31T00:00:00.000Z'),
    amount: 1000, status: 'active', referenceType: 'invoice', debitAccountCode: 'EXP-004', creditAccountCode: 'ADV-001', vaultId: null,
  }],
};

describe('direct advance payroll duplicate correction policy', () => {
  it('accepts only an exact direct advance duplicate that makes the month match', () => {
    expect(buildDirectAdvancePayrollDuplicatePreview(base)).toMatchObject({
      correctionMode: 'direct_advance_invoice', selectedLegacyTotal: 1000, differenceBefore: 1000, differenceAfter: 0,
    });
  });

  it('rejects a partial advance deduction or any non-zero residual', () => {
    expect(() => buildDirectAdvancePayrollDuplicatePreview({
      ...base,
      candidates: [{ ...base.candidates[0], payrollItemAdvanceDeduct: 1200 }],
    })).toThrow('ADVANCE_AMOUNT_DOES_NOT_EXACTLY_MATCH_PAYROLL_ITEM');
    expect(() => buildDirectAdvancePayrollDuplicatePreview({ ...base, ledgerPayrollCost: 49591 })).toThrow(
      'SELECTED_ROWS_DO_NOT_EXACTLY_RECONCILE_PAYROLL',
    );
  });
});

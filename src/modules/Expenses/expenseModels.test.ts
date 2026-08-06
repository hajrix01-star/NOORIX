import { describe, expect, it } from 'vitest';
import {
  EXPENSE_BATCH_INVALID_ROWS_ERROR,
  buildExpenseBatchPayload,
  buildExpenseBatchRows,
  buildExpensePaymentPayload,
  emptyExpensePaymentForm,
  summarizeExpenseBatchDraft,
  syncExpensePaymentFormFromLine,
  validateExpenseBatchRow,
  validateExpensePaymentForm,
} from './expenseModels';
import type { ExpenseLineRecord } from '../../types/api';

const fixedLine: ExpenseLineRecord = {
  id: 'line-fixed',
  nameAr: 'إيجار',
  kind: 'fixed_expense',
  categoryId: 'cat-1',
  supplierId: 'sup-1',
  referenceAmount: 1200,
  allowPaymentAmountOverride: false,
  installmentIntervalMonths: 3,
  category: { id: 'cat-1', account: { taxExempt: false } },
  supplier: { id: 'sup-1', isTaxRegistered: true },
};

const variableLine: ExpenseLineRecord = {
  id: 'line-variable',
  nameAr: 'صيانة',
  kind: 'expense',
  categoryId: 'cat-2',
  supplierId: 'sup-2',
  category: { id: 'cat-2', account: { taxExempt: true } },
  supplier: { id: 'sup-2', isTaxRegistered: true },
};

const taxableVariableLine: ExpenseLineRecord = {
  id: 'line-taxable-variable',
  nameAr: 'كهرباء',
  kind: 'expense',
  categoryId: 'cat-electricity',
  supplierId: 'sup-electricity',
  category: { id: 'cat-electricity', account: { taxExempt: false } },
  supplier: { id: 'sup-electricity', isTaxRegistered: true },
};

const nonTaxableGovernmentLine: ExpenseLineRecord = {
  ...fixedLine,
  id: 'line-gosi',
  nameAr: 'GOSI',
  supplierId: 'sup-gosi',
  supplier: { id: 'sup-gosi', isTaxRegistered: false },
};

describe('expenseModels', () => {
  it('syncs a fixed line into a draft payment form without making it official', () => {
    const form = syncExpensePaymentFormFromLine(
      { ...emptyExpensePaymentForm(2026), expenseLineId: fixedLine.id, transactionDate: '2026-07-07' },
      fixedLine,
    );

    expect(form.totalAmount).toBe('1200');
    expect(form.expenseCoverageYear).toBe(2026);
    expect(form.expenseMonthsCovered).toBe(3);
  });

  it('validates locked fixed expense amount and builds backend-owned invoice payload', () => {
    const form = {
      ...emptyExpensePaymentForm(2026),
      expenseLineId: fixedLine.id,
      totalAmount: '1200',
      primaryVaultId: 'vault-1',
      supplierInvoiceNumber: '',
      expenseCoverageYear: 2026,
      expenseCoverageQuarter: 2,
    };

    expect(validateExpensePaymentForm({ form, selectedLine: fixedLine, isTaxable: true })).toBeNull();
    expect(buildExpensePaymentPayload({ companyId: 'company-1', form, selectedLine: fixedLine, isTaxable: true })).toMatchObject({
      companyId: 'company-1',
      expenseLineId: fixedLine.id,
      kind: 'fixed_expense',
      totalAmount: 1200,
      isTaxable: true,
      vaultId: 'vault-1',
      expenseCoverageYear: 2026,
      expenseCoverageQuarter: 2,
      supplierInvoiceNumber: '',
    });
  });

  it('summarizes batch rows as draft preview and builds typed batch payload', () => {
    const rows = buildExpenseBatchRows(1);
    rows[0] = {
      ...rows[0],
      expenseLineId: variableLine.id,
      supplierInvoiceNumber: '',
      totalInclusive: '230',
      notes: 'draft',
    };

    expect(summarizeExpenseBatchDraft(rows, [variableLine], 0.15)).toEqual({
      totalNet: 230,
      totalTax: 0,
      total: 230,
      count: 1,
      invalidCount: 0,
      draftCount: 1,
    });
    expect(buildExpenseBatchPayload({
      companyId: 'company-1',
      batchDate: '2026-07-07',
      vaultId: 'vault-1',
      idempotencyKey: 'key-1',
      rows,
      expenseLines: [variableLine],
    }).items).toEqual([
      {
        expenseLineId: variableLine.id,
        kind: 'expense',
        totalAmount: 230,
        isTaxable: false,
        notes: 'صيانة - draft',
      },
    ]);
  });

  it('shows complete draft totals while keeping incomplete taxable rows out of the ready count', () => {
    const rows = buildExpenseBatchRows(4);
    rows[0] = { ...rows[0], expenseLineId: nonTaxableGovernmentLine.id, totalInclusive: '510.11' };
    rows[1] = { ...rows[1], expenseLineId: taxableVariableLine.id, totalInclusive: '987.38' };
    rows[2] = { ...rows[2], expenseLineId: taxableVariableLine.id, totalInclusive: '2909' };
    rows[3] = { ...rows[3], expenseLineId: taxableVariableLine.id, totalInclusive: '1489' };

    expect(summarizeExpenseBatchDraft(rows, [nonTaxableGovernmentLine, taxableVariableLine], 0.15)).toEqual({
      totalNet: 5193.05,
      totalTax: 702.44,
      total: 5895.49,
      count: 1,
      invalidCount: 3,
      draftCount: 4,
    });
    expect(validateExpenseBatchRow(rows[1], [nonTaxableGovernmentLine, taxableVariableLine])).toMatchObject({
      isCalculable: true,
      isValid: false,
      supplierInvoiceNumberRequired: true,
      supplierInvoiceNumberError: 'expenseBatchSupplierInvoiceRequired',
    });
  });

  it('rejects the whole payload instead of silently saving only valid rows', () => {
    const rows = buildExpenseBatchRows(3);
    rows[0] = { ...rows[0], expenseLineId: fixedLine.id, totalInclusive: '510.11' };
    rows[1] = { ...rows[1], expenseLineId: taxableVariableLine.id, totalInclusive: '987.38' };

    expect(() => buildExpenseBatchPayload({
      companyId: 'company-1',
      batchDate: '2026-08-06',
      vaultId: 'vault-1',
      idempotencyKey: 'key-all-or-nothing',
      rows,
      expenseLines: [fixedLine, taxableVariableLine],
    })).toThrow(EXPENSE_BATCH_INVALID_ROWS_ERROR);
  });

  it('ignores untouched rows and preserves entered row order once every row is valid', () => {
    const rows = buildExpenseBatchRows(3);
    rows[0] = { ...rows[0], expenseLineId: fixedLine.id, totalInclusive: '510.11' };
    rows[1] = {
      ...rows[1],
      expenseLineId: taxableVariableLine.id,
      supplierInvoiceNumber: 'ELEC-2026-08',
      totalInclusive: '987.38',
    };

    const payload = buildExpenseBatchPayload({
      companyId: 'company-1',
      batchDate: '2026-08-06',
      vaultId: 'vault-1',
      idempotencyKey: 'key-ordered',
      rows,
      expenseLines: [fixedLine, taxableVariableLine],
    });

    expect(payload.items).toHaveLength(2);
    expect(payload.items.map((item) => item.expenseLineId)).toEqual([fixedLine.id, taxableVariableLine.id]);
    expect(payload.items[1]).toMatchObject({
      supplierInvoiceNumber: 'ELEC-2026-08',
      totalAmount: 987.38,
      isTaxable: true,
    });
  });
});

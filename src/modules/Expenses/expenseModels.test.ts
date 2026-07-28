import { describe, expect, it } from 'vitest';
import {
  buildExpenseBatchPayload,
  buildExpenseBatchRows,
  buildExpensePaymentPayload,
  emptyExpensePaymentForm,
  summarizeExpenseBatchDraft,
  syncExpensePaymentFormFromLine,
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
});

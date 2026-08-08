import { describe, expect, it } from 'vitest';
import { buildVaultTransactionsPrintBody, vaultTransactionTypeLabel } from './vaultTransactionsPrintModel';

describe('vaultTransactionsPrintModel', () => {
  it('localizes known transaction types and preserves unknown values', () => {
    const labels = { sale: 'مبيعات', invoice: 'فاتورة' };
    expect(vaultTransactionTypeLabel('sale', labels)).toBe('مبيعات');
    expect(vaultTransactionTypeLabel('custom', labels)).toBe('custom');
  });

  it('builds a six-column ledger with full-period summary and safe escaped notes', () => {
    const body = buildVaultTransactionsPrintBody({
      rows: [{
        id: '1', referenceId: 'sale-1', documentNumber: 'DS-001', transactionDate: '2026-08-08',
        referenceType: 'sale', amount: 100, debitAccountId: 'vault', creditAccountId: 'sales',
        debit: 100, credit: null, notesDisplay: '<unsafe>',
      }],
      totalIn: 100,
      totalOut: 25,
      periodBalance: 75,
      totalTransactions: 1,
      labels: {
        documentNumber: 'رقم السند', date: 'التاريخ', type: 'النوع', notes: 'ملاحظات',
        debit: 'داخل', credit: 'خارج', total: 'الإجمالي', totalIn: 'إجمالي الداخل',
        totalOut: 'إجمالي الخارج', periodNet: 'صافي الفترة', transactionCount: 'عدد الحركات',
      },
      typeLabels: { sale: 'مبيعات' },
      formatDate: (value) => value,
      formatAmount: (value) => value.toFixed(1),
    });

    expect(body).toContain('vault-print-summary');
    expect(body).toContain('vault-print-table');
    expect(body).toContain('مبيعات');
    expect(body).toContain('100.0');
    expect(body).toContain('&lt;unsafe&gt;');
    expect((body.match(/<th(?:\s|>)/g) || []).length).toBe(6);
  });
});

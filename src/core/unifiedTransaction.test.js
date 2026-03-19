/**
 * Unit tests for unifiedTransaction and validateTransactionPayload.
 * Run: npm run test
 */
import { describe, it, expect, vi } from 'vitest';
import {
  validateTransactionPayload,
  unifiedTransaction,
} from './unifiedTransaction';

describe('validateTransactionPayload', () => {
  it('throws TRANSACTION_PAYLOAD_REQUIRED when payload is missing', () => {
    expect(() => validateTransactionPayload('sales:summary', null)).toThrow(
      'TRANSACTION_PAYLOAD_REQUIRED'
    );
    expect(() => validateTransactionPayload('sales:summary', undefined)).toThrow(
      'TRANSACTION_PAYLOAD_REQUIRED'
    );
  });

  it('throws TRANSACTION_AMOUNT_MUST_BE_POSITIVE when amount is zero or negative', () => {
    expect(() =>
      validateTransactionPayload('sales:summary', {
        amount: 0,
        transactionDate: '2025-01-01',
      })
    ).toThrow('TRANSACTION_AMOUNT_MUST_BE_POSITIVE');
    expect(() =>
      validateTransactionPayload('invoices:purchase', {
        totalAmount: -100,
        transactionDate: '2025-01-01',
      })
    ).toThrow('TRANSACTION_AMOUNT_MUST_BE_POSITIVE');
  });

  it('throws TRANSACTION_DATE_REQUIRED when date is missing', () => {
    expect(() =>
      validateTransactionPayload('sales:summary', {
        amount: 100,
      })
    ).toThrow('TRANSACTION_DATE_REQUIRED');
  });

  it('accepts sales (inflow) with vault and no supplier', () => {
    expect(() =>
      validateTransactionPayload('sales:summary', {
        amount: 100,
        transactionDate: '2025-01-01',
        vaultId: 'v1',
      })
    ).not.toThrow();
  });

  it('throws VAULT_REQUIRED for sales when vault is missing', () => {
    expect(() =>
      validateTransactionPayload('sales:summary', {
        amount: 100,
        transactionDate: '2025-01-01',
      })
    ).toThrow('VAULT_REQUIRED');
  });

  it('requires supplier and payment method for non-inflow (expense/invoice)', () => {
    expect(() =>
      validateTransactionPayload('invoices:purchase', {
        amount: 100,
        transactionDate: '2025-01-01',
      })
    ).toThrow('SUPPLIER_REQUIRED');
    expect(() =>
      validateTransactionPayload('invoices:purchase', {
        amount: 100,
        transactionDate: '2025-01-01',
        supplierId: 's1',
      })
    ).toThrow('PAYMENT_METHOD_REQUIRED');
  });

  it('accepts expense/invoice when supplier and payment method present', () => {
    expect(() =>
      validateTransactionPayload('invoices:purchase', {
        amount: 100,
        transactionDate: '2025-01-01',
        supplierId: 's1',
        paymentMethodId: 'pm1',
      })
    ).not.toThrow();
  });

  it('requires fromVault and toVault for transfer', () => {
    expect(() =>
      validateTransactionPayload('transfer', {
        amount: 100,
        transactionDate: '2025-01-01',
      })
    ).toThrow('VAULT_REQUIRED');
    expect(() =>
      validateTransactionPayload('transfer', {
        amount: 100,
        transactionDate: '2025-01-01',
        fromVaultId: 'v1',
      })
    ).toThrow('VAULT_REQUIRED');
    expect(() =>
      validateTransactionPayload('transfer', {
        amount: 100,
        transactionDate: '2025-01-01',
        fromVaultId: 'v1',
        toVaultId: 'v2',
      })
    ).not.toThrow();
  });
});

describe('unifiedTransaction', () => {
  it('throws TRANSACTION_KIND_REQUIRED when kind is missing', async () => {
    await expect(
      unifiedTransaction({
        payload: { amount: 100, transactionDate: '2025-01-01', vaultId: 'v1' },
        runInTransaction: vi.fn().mockResolvedValue({}),
      })
    ).rejects.toThrow('TRANSACTION_KIND_REQUIRED');
  });

  it('throws RUN_IN_TRANSACTION_REQUIRED when runInTransaction is missing', async () => {
    await expect(
      unifiedTransaction({
        kind: 'sales:summary',
        payload: { amount: 100, transactionDate: '2025-01-01', vaultId: 'v1' },
      })
    ).rejects.toThrow('RUN_IN_TRANSACTION_REQUIRED');
  });

  it('calls runInTransaction with payload and dual dates on valid input', async () => {
    const runInTransaction = vi.fn().mockResolvedValue({ id: 'tx1' });
    await unifiedTransaction({
      kind: 'sales:summary',
      payload: { amount: 100, transactionDate: '2025-01-01', vaultId: 'v1' },
      runInTransaction,
    });
    expect(runInTransaction).toHaveBeenCalledTimes(1);
    const call = runInTransaction.mock.calls[0][0];
    expect(call.payload).toEqual({ amount: 100, transactionDate: '2025-01-01', vaultId: 'v1' });
    expect(call.transactionDate).toBeDefined();
    expect(call.entryDate).toBeDefined();
  });

  it('returns result, transactionDate, entryDate on success', async () => {
    const runInTransaction = vi.fn().mockResolvedValue({ id: 'tx1' });
    const out = await unifiedTransaction({
      kind: 'sales:summary',
      payload: { amount: 100, transactionDate: '2025-01-01', vaultId: 'v1' },
      runInTransaction,
    });
    expect(out.result).toEqual({ id: 'tx1' });
    expect(out.transactionDate).toBeDefined();
    expect(out.entryDate).toBeDefined();
  });
});

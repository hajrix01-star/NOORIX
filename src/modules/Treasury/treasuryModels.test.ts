import { describe, expect, it } from 'vitest';
import {
  buildTreasurySummary,
  buildVaultSavePayload,
  initVaultForm,
  normalizeVaultTransactions,
  splitVaultGroups,
} from './treasuryModels';
import type { VaultRecord, VaultTransactionRecord } from '../../types/api';

const vault = (overrides: Partial<VaultRecord>): VaultRecord => ({
  id: overrides.id ?? 'v1',
  accountId: overrides.accountId ?? 'a1',
  nameAr: overrides.nameAr ?? 'خزنة',
  nameEn: overrides.nameEn,
  type: overrides.type ?? 'cash',
  ...overrides,
});

describe('treasuryModels', () => {
  it('builds summary from active visible backend totals only', () => {
    const summary = buildTreasurySummary([
      vault({ id: 'v1', accountId: 'a1', totalIn: '100.50', totalOut: 30, balance: '70.50' }),
      vault({ id: 'v2', accountId: 'a2', totalIn: 20, totalOut: 5, balance: 15, isArchived: true }),
      vault({ id: 'v3', accountId: 'a3', totalIn: 9, totalOut: 9, balance: 0, isActive: false }),
    ]);

    expect(summary).toEqual({ totalBalance: 70.5, totalIn: 100.5, totalOut: 30 });
  });

  it('splits and orders vaults by role without mutating the source list', () => {
    const source = [
      vault({ id: 'v2', accountId: 'a2', nameAr: 'ب', sortOrder: 2 }),
      vault({ id: 'v1', accountId: 'a1', nameAr: 'أ', sortOrder: 1, isSalesChannel: true }),
      vault({ id: 'v3', accountId: 'a3', nameAr: 'ج', sortOrder: 0, isArchived: true }),
    ];

    const groups = splitVaultGroups(source, true);

    expect(groups.salesChannels.map((item) => item.id)).toEqual(['v1']);
    expect(groups.otherVaults.map((item) => item.id)).toEqual(['v2']);
    expect(groups.archivedVaults.map((item) => item.id)).toEqual(['v3']);
    expect(source.map((item) => item.id)).toEqual(['v2', 'v1', 'v3']);
  });

  it('normalizes form payload to supported backend vault types', () => {
    const form = initVaultForm(vault({ id: 'v1', accountId: 'a1', type: 'bank', paymentMethod: 'card' }));
    const payload = buildVaultSavePayload({ ...form, nameAr: ' بنك ', nameEn: ' Bank ', notes: ' note ' });

    expect(payload).toEqual({
      nameAr: 'بنك',
      nameEn: 'Bank',
      type: 'bank',
      isSalesChannel: false,
      showAsPaymentMethod: true,
      paymentMethod: 'card',
      notes: 'note',
    });
  });

  it('maps ledger rows to debit and credit display values for the selected vault account', () => {
    const rows: VaultTransactionRecord[] = [
      {
        id: 'l1',
        debitAccountId: 'vault-account',
        creditAccountId: 'other',
        amount: '25',
        transactionDate: '2026-07-07',
      },
      {
        id: 'l2',
        debitAccountId: 'other',
        creditAccountId: 'vault-account',
        amount: 10,
        transactionDate: '2026-07-07',
      },
    ];

    expect(normalizeVaultTransactions(rows, 'vault-account', () => null)).toMatchObject([
      { id: 'l1', debit: 25, credit: null },
      { id: 'l2', debit: null, credit: 10 },
    ]);
  });
});

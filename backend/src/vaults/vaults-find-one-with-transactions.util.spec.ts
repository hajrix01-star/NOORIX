import { findOneWithTransactions } from './vaults-find-one-with-transactions.util';

describe('vaults-find-one-with-transactions.util', () => {
  it('returns period totals using the same date filter as the transaction list', async () => {
    const aggregate = jest
      .fn()
      .mockResolvedValueOnce({ _sum: { amount: 120 } })
      .mockResolvedValueOnce({ _sum: { amount: 45 } });
    const prisma = Object.assign(Object.create(null), {
      vault: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'vault-1',
          companyId: 'company-1',
          accountId: 'account-1',
          nameAr: 'Vault',
          type: 'cash',
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      ledgerEntry: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        aggregate,
      },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      dailySalesSummary: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
      vaultTransfer: { findMany: jest.fn().mockResolvedValue([]) },
    });

    const result = await findOneWithTransactions(
      prisma,
      'vault-1',
      'company-1',
      '2026-07-01T00:00:00.000Z',
      '2026-07-31T23:59:59.999Z',
      1,
      50,
    );

    expect(result.transactions.periodTotalIn).toBe(120);
    expect(result.transactions.periodTotalOut).toBe(45);
    expect(result.transactions.periodBalance).toBe(75);
    expect(aggregate.mock.calls[0][0].where.transactionDate).toEqual({
      gte: new Date('2026-07-01T00:00:00.000Z'),
      lte: new Date('2026-07-31T23:59:59.999Z'),
    });
    expect(aggregate.mock.calls[1][0].where.transactionDate).toEqual({
      gte: new Date('2026-07-01T00:00:00.000Z'),
      lte: new Date('2026-07-31T23:59:59.999Z'),
    });
  });
});

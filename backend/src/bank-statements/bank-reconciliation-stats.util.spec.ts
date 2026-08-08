import { computeBankReconciliationStats } from './bank-reconciliation-stats.util';

describe('computeBankReconciliationStats', () => {
  it('counts non-bank to bank transfers but excludes bank-to-bank relocations', async () => {
    const prisma = {
      vault: { findMany: jest.fn().mockResolvedValue([
        { id: 'cash', accountId: 'acc-cash', type: 'cash', nameAr: 'Cash', nameEn: null, paymentMethod: 'cash', bankReconciliationEnabled: false },
        { id: 'bank-a', accountId: 'acc-bank-a', type: 'cash', nameAr: 'Renamed', nameEn: null, paymentMethod: 'cash', bankReconciliationEnabled: true },
        { id: 'bank-b', accountId: 'acc-bank-b', type: 'app', nameAr: 'Bank B', nameEn: null, paymentMethod: 'mada', bankReconciliationEnabled: true },
      ]) },
      invoice: { findMany: jest.fn().mockResolvedValue([
        { totalAmount: 1000, vaultId: 'bank-a' },
        { totalAmount: 300, vaultId: 'cash' },
      ]) },
      vaultTransfer: { findMany: jest.fn().mockResolvedValue([
        { amount: 250, fromVaultId: 'cash', toVaultId: 'bank-a', status: 'posted', reversal: null },
        { amount: 900, fromVaultId: 'bank-a', toVaultId: 'bank-b', status: 'posted', reversal: null },
      ]) },
    };

    const result = await computeBankReconciliationStats(
      prisma as never,
      'company-1',
      '2026-08-01',
      '2026-08-31',
    );

    expect(prisma.vaultTransfer.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        reversalOfId: null,
      }),
      select: {
        amount: true,
        fromVaultId: true,
        toVaultId: true,
        status: true,
        reversal: { select: { transactionDate: true } },
      },
    });
    expect(result.system_data).toEqual({
      sales_bank_total: 1000,
      cash_deposits_total: 250,
      expected_credits: 1250,
      sale_invoice_count: 1,
    });
  });

  it('excludes a backdated reversal using its accounting date, not its later entry timestamp', async () => {
    const prisma = {
      vault: { findMany: jest.fn().mockResolvedValue([
        { id: 'cash', accountId: 'acc-cash', bankReconciliationEnabled: false },
        { id: 'bank', accountId: 'acc-bank', bankReconciliationEnabled: true },
      ]) },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      vaultTransfer: { findMany: jest.fn().mockResolvedValue([{
        amount: 250,
        fromVaultId: 'cash',
        toVaultId: 'bank',
        status: 'reversed',
        reversedAt: new Date('2026-09-05T12:00:00.000Z'),
        reversal: { transactionDate: new Date('2026-08-15T00:00:00.000Z') },
      }]) },
    };

    const result = await computeBankReconciliationStats(
      prisma as never,
      'company-1',
      '2026-08-01',
      '2026-08-31',
    );

    expect(result.system_data.cash_deposits_total).toBe(0);
  });

  it('keeps an original effective when its reversal accounting date is after the period', async () => {
    const prisma = {
      vault: { findMany: jest.fn().mockResolvedValue([
        { id: 'cash', accountId: 'acc-cash', bankReconciliationEnabled: false },
        { id: 'bank', accountId: 'acc-bank', bankReconciliationEnabled: true },
      ]) },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      vaultTransfer: { findMany: jest.fn().mockResolvedValue([{
        amount: 250,
        fromVaultId: 'cash',
        toVaultId: 'bank',
        status: 'reversed',
        reversedAt: new Date('2026-08-10T12:00:00.000Z'),
        reversal: { transactionDate: new Date('2026-09-05T00:00:00.000Z') },
      }]) },
    };

    const result = await computeBankReconciliationStats(
      prisma as never,
      'company-1',
      '2026-08-01',
      '2026-08-31',
    );

    expect(result.system_data.cash_deposits_total).toBe(250);
  });
});

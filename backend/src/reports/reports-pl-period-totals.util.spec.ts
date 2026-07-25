import type { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { loadPlPeriodTotals } from './reports-pl-period-totals.util';

describe('loadPlPeriodTotals', () => {
  it('uses ledger totals and sales channels without dropping ledger-only expenses', async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([
        {
          expenses: '50980.28',
          other_sales: '14.50',
          purchases: '42674.22',
        },
      ])
      .mockResolvedValueOnce([{ sales: '128699.50' }]);
    const prisma = { $queryRaw: queryRaw } as unknown as TenantPrismaService;

    await expect(
      loadPlPeriodTotals(prisma, 'company-1', '2026-07-01', '2026-07-25'),
    ).resolves.toEqual({
      expenses: '50980.2800',
      purchases: '42674.2200',
      sales: '128714.0000',
    });
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});

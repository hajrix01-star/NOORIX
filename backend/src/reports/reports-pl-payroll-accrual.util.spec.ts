import { loadCompletedUnpaidPayrollPlEntries } from './reports-pl-payroll-accrual.util';

describe('loadCompletedUnpaidPayrollPlEntries', () => {
  it('adds completed unpaid payroll runs to expenses in payroll month', async () => {
    const prisma = {
      payrollRun: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'run-may',
            totalAmount: '50000',
            payrollMonth: new Date(Date.UTC(2026, 4, 1)),
          },
        ]),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const entries = await loadCompletedUnpaidPayrollPlEntries(prisma as never, 'co-1', 2026);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.groupKey).toBe('expenses');
    expect(entries[0]?.monthIndex).toBe(4);
    expect(entries[0]?.itemKey).toBe('kind:salary');
    expect(Number(entries[0]?.amount)).toBe(50000);
  });

  it('skips runs that already have an active salary invoice (issued payment)', async () => {
    const prisma = {
      payrollRun: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'run-paid',
            totalAmount: '30000',
            payrollMonth: new Date(Date.UTC(2026, 3, 1)),
          },
        ]),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([{ batchId: 'run-paid' }]),
      },
    };

    const entries = await loadCompletedUnpaidPayrollPlEntries(prisma as never, 'co-1', 2026);
    expect(entries).toHaveLength(0);
  });
});

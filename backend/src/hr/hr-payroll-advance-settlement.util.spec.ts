import { Prisma } from '@prisma/client';
import { applyPayrollAdvanceSettlements } from './hr-payroll-advance-settlement.util';

describe('payroll advance settlement selections', () => {
  it('settles only the explicitly checked advance', async () => {
    const selectedAdvance = {
      id: 'adv-2',
      employeeId: 'emp-1',
      invoiceNumber: 'ADV-002',
      totalAmount: new Prisma.Decimal(800),
      settledAmount: new Prisma.Decimal(0),
      installmentAmount: new Prisma.Decimal(200),
      notes: null,
    };
    const findMany = jest.fn().mockResolvedValue([selectedAdvance]);
    const update = jest.fn().mockResolvedValue(selectedAdvance);
    const createDeduction = jest.fn().mockResolvedValue({ id: 'deduction-1' });
    const db = {
      invoice: {
        findMany,
        update,
      },
      employeeDeduction: {
        create: createDeduction,
      },
    };

    await applyPayrollAdvanceSettlements(
      db,
      {
        companyId: 'company-1',
        runNumber: 'PR-2608-001',
        payrollMonth: new Date('2026-08-01T00:00:00.000Z'),
        items: [
          {
            employeeId: 'emp-1',
            advancesDeduct: new Prisma.Decimal(200),
            advanceSelections: [{ advanceId: 'adv-2', amount: 200 }],
            employee: { name: 'Employee' },
          },
        ],
      },
      '2026-08-31',
      'tenant-1',
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['adv-2'] } }),
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'adv-2' } }),
    );
    expect(createDeduction).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referenceId: 'adv-2', amount: new Prisma.Decimal(200) }),
      }),
    );
  });
});

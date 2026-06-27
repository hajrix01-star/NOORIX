import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContext } from '../common/tenant-context';
import { HrPayrollAncillaryService } from './hr-payroll-ancillary.service';

describe('HrPayrollAncillaryService', () => {
  function runWithTenant<T>(fn: () => Promise<T>): Promise<T> {
    let promise: Promise<T> | undefined;
    TenantContext.run('tenant-1', null, () => {
      promise = fn();
    });
    return promise as Promise<T>;
  }

  function makeService(snapshotTotal = 10437.5) {
    const tx = {
      employee: {
        update: jest.fn().mockResolvedValue({}),
      },
      employeeMovement: {
        create: jest.fn().mockResolvedValue({
          id: 'mov-1',
          companyId: 'co-1',
          employeeId: 'emp-1',
          movementType: 'raise',
          previousValue: String(snapshotTotal),
          newValue: '11437.5',
        }),
      },
    };
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'emp-1',
          basicSalary: new Prisma.Decimal(6000),
          housingAllowance: new Prisma.Decimal(1000),
          transportAllowance: new Prisma.Decimal(500),
          otherAllowance: new Prisma.Decimal(0),
          workHours: '10',
          workSchedule: '[NOORIX_WD:26]',
        }),
      },
      withTenant: jest.fn(async (fn: (arg: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const compensationSnapshot = {
      getCompanySnapshots: jest.fn().mockResolvedValue({
        items: [
          {
            employeeId: 'emp-1',
            salaryPackage: {
              total: snapshotTotal,
              customAllowanceTotal: 250,
            },
          },
        ],
      }),
    };

    return {
      service: new HrPayrollAncillaryService(prisma as any, audit as any, compensationSnapshot as any),
      prisma,
      tx,
      compensationSnapshot,
    };
  }

  it('creates raise movements as one central salary transaction', async () => {
    const { service, prisma, tx, compensationSnapshot } = makeService();

    const result = await runWithTenant(() =>
      service.createMovement({
        companyId: 'co-1',
        employeeId: 'emp-1',
        movementType: 'raise',
        amount: 1000,
        previousValue: '10437.5',
        newValue: '11437.5',
        effectiveDate: '2026-07-01T12:00:00.000Z',
      }),
    );

    expect(compensationSnapshot.getCompanySnapshots).toHaveBeenCalledWith('co-1', ['emp-1']);
    expect(prisma.withTenant).toHaveBeenCalledTimes(1);
    expect(tx.employee.update).toHaveBeenCalledWith({
      where: { id: 'emp-1' },
      data: { basicSalary: new Prisma.Decimal(6727.27) },
    });
    expect(tx.employeeMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: 'raise',
          previousValue: '10437.5',
          newValue: '11437.5',
        }),
      }),
    );
    expect(result).toMatchObject({ id: 'mov-1', salaryUpdated: true });
  });

  it('rejects stale raise totals that do not match the central snapshot', async () => {
    const { service } = makeService(10437.5);

    await expect(
      runWithTenant(() => service.createMovement({
        companyId: 'co-1',
        employeeId: 'emp-1',
        movementType: 'raise',
        newValue: '11437.5',
        previousValue: '9999',
        effectiveDate: '2026-07-01T12:00:00.000Z',
      })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

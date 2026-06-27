import { NotFoundException } from '@nestjs/common';
import { HrCompensationSnapshotService } from './hr-compensation-snapshot.service';

describe('HrCompensationSnapshotService', () => {
  it('builds a read-only employee compensation snapshot from database rows and central formulas', async () => {
    const prisma = {
      employee: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'emp-1',
          companyId: 'co-1',
          basicSalary: 6000,
          housingAllowance: 1000,
          transportAllowance: 500,
          otherAllowance: 0,
          workHours: '10',
          workSchedule: '[NOORIX_WD:26]',
          customAllowances: [
            { id: 'ca-1', employeeId: 'emp-1', nameAr: 'Meal', amount: 100 },
            { id: 'ca-2', employeeId: 'emp-1', nameAr: 'Phone', amount: '150' },
          ],
        }),
      },
      invoice: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'adv-1',
              invoiceNumber: 'ADV-1',
              transactionDate: new Date('2026-06-01T00:00:00.000Z'),
              totalAmount: 1000,
              settledAmount: 250,
              installmentCount: null,
              installmentAmount: null,
              notes: '',
              status: 'active',
            },
          ])
          .mockResolvedValueOnce([{ batchId: 'pr-1', invoiceNumber: 'SAL-1' }]),
      },
      payrollRunItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pri-1',
            grossSalary: 10437.5,
            allowancesAdd: 100,
            deductions: 50,
            advancesDeduct: 200,
            netSalary: 10287.5,
            notes: 'June',
            payrollRun: {
              id: 'pr-1',
              runNumber: 'PR-2606-001',
              payrollMonth: new Date('2026-06-01T00:00:00.000Z'),
              status: 'draft',
            },
          },
        ]),
      },
    } as any;

    const service = new HrCompensationSnapshotService(prisma);
    const snapshot = await service.getEmployeeSnapshot('co-1', 'emp-1');

    expect(snapshot.source).toBe('database');
    expect(snapshot.salaryPackage.customAllowanceTotal).toBe(250);
    expect(snapshot.salaryPackage.total).toBe(10437.5);
    expect(snapshot.advances.totals.remainingAmount).toBe(750);
    expect(snapshot.payrollItems).toHaveLength(1);
    expect(snapshot.payrollItems[0].payrollRun.issuedSalaryInvoiceNumber).toBe('SAL-1');
    expect(snapshot.latestPayrollItem?.computedNetSalary).toBe(10287.5);
    expect(snapshot.latestPayrollItem?.netMatchesCentralFormula).toBe(true);
  });

  it('throws when the employee is not in the requested company', async () => {
    const service = new HrCompensationSnapshotService({
      employee: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any);

    await expect(service.getEmployeeSnapshot('co-1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

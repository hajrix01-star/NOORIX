import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { HrPayrollReconciliationService } from './hr-payroll-reconciliation.service';

describe('HrPayrollReconciliationService', () => {
  it('flags the historical July 13,100 excess without mutating any record', async () => {
    const prisma = {
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'salary-expense' }) },
      payrollRun: { findMany: jest.fn().mockResolvedValue([{
        id: 'run-jul', runNumber: 'PR-2607-001', payrollMonth: new Date('2026-07-01T00:00:00.000Z'),
        totalAmount: new Prisma.Decimal(17851), status: 'completed',
        items: [{ id: 'item-1', advancesDeduct: new Prisma.Decimal(30200), employee: { id: 'emp-1', name: 'Employee' } }],
      }]) },
      invoice: { findMany: jest.fn().mockResolvedValue([{
        id: 'salary-invoice', batchId: 'run-jul', invoiceNumber: 'SAL-1', invoiceDate: new Date('2026-07-01T00:00:00.000Z'),
        transactionDate: new Date('2026-07-31T00:00:00.000Z'), totalAmount: new Prisma.Decimal(17851),
        employeeId: null, employee: null,
      }]) },
      payrollAdvanceSettlement: { findMany: jest.fn().mockResolvedValue([]) },
      historicalPartTimePayrollLink: { findMany: jest.fn().mockResolvedValue([]) },
      employeeDeduction: { findMany: jest.fn().mockResolvedValue([
        { id: 'deduction-repair', employeeId: 'emp-1', notes: '[PAYROLL_COST_GAP_REPAIR_V2] run=PR-2607-001, payrollItem=item-1, nonCash=true' },
        { id: 'deduction-legacy', employeeId: 'emp-1', notes: 'خصم سلفة قديم من مسير PR-2607-001' },
      ]) },
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([
        { id: 'ledger-base', referenceType: 'salary', referenceId: 'salary-invoice', amount: new Prisma.Decimal(17851), transactionDate: new Date('2026-07-31T00:00:00.000Z'), status: 'active', employeeId: 'emp-1', employee: { name: 'Employee' } },
        { id: 'ledger-repair', referenceType: 'advance_settlement', referenceId: 'deduction-repair', amount: new Prisma.Decimal(30200), transactionDate: new Date('2026-07-31T00:00:00.000Z'), status: 'active', employeeId: 'emp-1', employee: { name: 'Employee' } },
        { id: 'ledger-legacy', referenceType: 'advance_settlement', referenceId: 'deduction-legacy', amount: new Prisma.Decimal(13100), transactionDate: new Date('2026-07-06T00:00:00.000Z'), status: 'active', employeeId: 'emp-1', employee: { name: 'Employee' } },
      ]) },
    } as unknown as TenantPrismaService;
    const service = new HrPayrollReconciliationService(prisma);

    const result = await service.getYear('company-1', 2026, true);
    const july = result.months.find((month) => month.month === '2026-07')!;

    expect(july).toMatchObject({
      payrollRunsTotal: 48051,
      salaryInvoicesTotal: 17851,
      structuredAdvanceSettlementsTotal: 0,
      documentedHistoricalRepairTotal: 30200,
      legacyAdvanceSettlementLedgerTotal: 13100,
      ledgerPayrollCostTotal: 61151,
      difference: 13100,
      confidence: 'low',
      reviewStatus: 'needs_review',
    });
    expect(july.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'legacy_ledger', amount: 13100, confidence: 'low' }),
      expect.objectContaining({ source: 'documented_historical_repair', amount: 30200, confidence: 'medium', payrollItemId: 'item-1' }),
    ]));
    expect(prisma.payrollRun.update).toBeUndefined();
    expect(prisma.ledgerEntry.updateMany).toBeUndefined();
  });

  it('lists an unlinked payroll-cost ledger entry without treating it as a salary run', async () => {
    const prisma = {
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'salary-expense' }) },
      payrollRun: { findMany: jest.fn().mockResolvedValue([{
        id: 'run-apr', runNumber: 'PR-2605-001', payrollMonth: new Date('2026-04-01T00:00:00.000Z'),
        totalAmount: new Prisma.Decimal(41300), status: 'completed', items: [],
      }]) },
      invoice: { findMany: jest.fn().mockResolvedValue([]) },
      payrollAdvanceSettlement: { findMany: jest.fn().mockResolvedValue([]) },
      historicalPartTimePayrollLink: { findMany: jest.fn().mockResolvedValue([]) },
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([
        { id: 'accrual', referenceType: 'payroll_accrual', referenceId: 'run-apr', amount: new Prisma.Decimal(41300), transactionDate: new Date('2026-04-30T00:00:00.000Z'), status: 'active', employeeId: null, employee: null },
        { id: 'unlinked', referenceType: 'historical_manual_salary', referenceId: 'legacy-1', amount: new Prisma.Decimal(1700), transactionDate: new Date('2026-04-30T00:00:00.000Z'), status: 'active', employeeId: 'emp-1', employee: { name: 'Employee' } },
      ]) },
    } as unknown as TenantPrismaService;

    const result = await new HrPayrollReconciliationService(prisma).getYear('company-1', 2026, true);
    const april = result.months.find((month) => month.month === '2026-04')!;

    expect(april).toMatchObject({
      payrollRunsTotal: 41300,
      unexplainedPayrollLedgerTotal: 1700,
      ledgerPayrollCostTotal: 43000,
      difference: 1700,
      reviewStatus: 'needs_review',
    });
    expect(april.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'unexplained_payroll_ledger', ledgerEntryId: 'unlinked', amount: 1700, confidence: 'low' }),
    ]));
    expect(prisma.ledgerEntry.updateMany).toBeUndefined();
  });

  it('attributes a January-paid salary invoice to its December payroll run', async () => {
    const prisma = {
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'salary-expense' }) },
      payrollRun: { findMany: jest.fn().mockResolvedValue([{
        id: 'run-dec', runNumber: 'PR-2612-001', payrollMonth: new Date('2026-12-01T00:00:00.000Z'),
        totalAmount: new Prisma.Decimal(1000), status: 'completed', items: [],
      }]) },
      invoice: { findMany: jest.fn().mockResolvedValue([{
        id: 'invoice-jan', batchId: 'run-dec', invoiceNumber: 'SAL-DEC', invoiceDate: new Date('2026-12-01T00:00:00.000Z'),
        transactionDate: new Date('2027-01-03T00:00:00.000Z'), totalAmount: new Prisma.Decimal(1000), employeeId: null, employee: null,
      }]) },
      payrollAdvanceSettlement: { findMany: jest.fn().mockResolvedValue([]) },
      historicalPartTimePayrollLink: { findMany: jest.fn().mockResolvedValue([]) },
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([{
        id: 'ledger-dec', referenceType: 'payroll_accrual', referenceId: 'run-dec', amount: new Prisma.Decimal(1000),
        transactionDate: new Date('2026-12-31T00:00:00.000Z'), status: 'active', employeeId: null, employee: null,
      }]) },
    } as unknown as TenantPrismaService;

    const result = await new HrPayrollReconciliationService(prisma).getYear('company-1', 2026);
    expect(result.months.find((month) => month.month === '2026-12')?.salaryInvoicesTotal).toBe(1000);
    expect((prisma.invoice.findMany as jest.Mock).mock.calls[0][0].where.OR).toEqual(expect.arrayContaining([
      { batchId: { in: ['run-dec'] } },
      expect.objectContaining({ transactionDate: expect.any(Object) }),
    ]));
  });

  it('includes a historical standalone salary payment in expected payroll cost without changing the ledger', async () => {
    const prisma = {
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'salary-expense' }) },
      payrollRun: { findMany: jest.fn().mockResolvedValue([{
        id: 'run-may', runNumber: 'PR-2605-001', payrollMonth: new Date('2026-05-01T00:00:00.000Z'),
        totalAmount: new Prisma.Decimal(46825.83), status: 'completed', items: [],
      }]) },
      invoice: { findMany: jest.fn().mockResolvedValue([{
        id: 'standalone-salary', batchId: null, invoiceNumber: 'SAL-LEGACY-1', invoiceDate: new Date('2026-05-01T00:00:00.000Z'),
        transactionDate: new Date('2026-05-31T00:00:00.000Z'), totalAmount: new Prisma.Decimal(1265),
        employeeId: 'emp-1', employee: { name: 'Employee' },
      }]) },
      payrollAdvanceSettlement: { findMany: jest.fn().mockResolvedValue([]) },
      historicalPartTimePayrollLink: { findMany: jest.fn().mockResolvedValue([]) },
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([
        { id: 'salary-ledger', referenceType: 'salary', referenceId: 'standalone-salary', amount: new Prisma.Decimal(48090.83), transactionDate: new Date('2026-05-31T00:00:00.000Z'), status: 'active', employeeId: 'emp-1', employee: { name: 'Employee' } },
      ]) },
    } as unknown as TenantPrismaService;

    const result = await new HrPayrollReconciliationService(prisma).getYear('company-1', 2026, true);
    const may = result.months.find((month) => month.month === '2026-05')!;

    expect(may).toMatchObject({
      payrollRunsTotal: 46825.83,
      standaloneSalaryPaymentsTotal: 1265,
      payrollExpectedCostTotal: 48090.83,
      ledgerPayrollCostTotal: 48090.83,
      difference: 0,
      reviewStatus: 'matched',
    });
    expect(may.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: 'historical_standalone_salary', amount: 1265, confidence: 'medium' }),
    ]));
    expect(prisma.ledgerEntry.updateMany).toBeUndefined();
  });
});

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
    expect((prisma as any).payrollRun.update).toBeUndefined();
    expect((prisma as any).ledgerEntry.updateMany).toBeUndefined();
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
      ledgerEntry: { findMany: jest.fn().mockResolvedValue([{
        id: 'ledger-dec', referenceType: 'payroll_accrual', referenceId: 'run-dec', amount: new Prisma.Decimal(1000),
        transactionDate: new Date('2026-12-31T00:00:00.000Z'), status: 'active', employeeId: null, employee: null,
      }]) },
    } as unknown as TenantPrismaService;

    const result = await new HrPayrollReconciliationService(prisma).getYear('company-1', 2026);
    expect(result.months.find((month) => month.month === '2026-12')?.salaryInvoicesTotal).toBe(1000);
    expect((prisma.invoice.findMany as jest.Mock).mock.calls[0][0].where.batchId).toEqual({ in: ['run-dec'] });
  });
});

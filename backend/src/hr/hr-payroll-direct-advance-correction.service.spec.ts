import { Prisma } from '@prisma/client';
import { HrPayrollDirectAdvanceCorrectionService } from './hr-payroll-direct-advance-correction.service';

const d = (value: number) => new Prisma.Decimal(value);

describe('HrPayrollDirectAdvanceCorrectionService', () => {
  it('cancels only the directly duplicated non-cash ledger row after exact proof', async () => {
    const run = {
      id: 'run-1', companyId: 'company-1', runNumber: 'PR-2606-001', status: 'completed',
      payrollMonth: new Date('2026-05-01T00:00:00.000Z'), totalAmount: d(45826),
      items: [{ id: 'item-1', employeeId: 'employee-1', advancesDeduct: d(1000) }],
    };
    const ledger = {
      id: 'ledger-1', companyId: 'company-1', referenceType: 'invoice', referenceId: 'advance-1', employeeId: 'employee-1',
      amount: d(1000), transactionDate: new Date('2026-05-31T00:00:00.000Z'), status: 'active', vaultId: null,
      debitAccount: { code: 'EXP-004' }, creditAccount: { code: 'ADV-001' },
    };
    let audit: Record<string, unknown> | null = null;
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      payrollRun: { findFirst: jest.fn().mockResolvedValue(run), findMany: jest.fn().mockResolvedValue([run]) },
      ledgerEntry: {
        findMany: jest.fn().mockResolvedValue([ledger]),
        aggregate: jest.fn().mockImplementation(() => Promise.resolve({ _sum: { amount: ledger.status === 'active' ? d(49091) : d(48091) } })),
      },
      invoice: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'advance-1', employeeId: 'employee-1', invoiceNumber: 'ADV-001', totalAmount: d(1000),
          notes: 'سلفة — عمر السوري\n[ADV_PAYROLL] run=PR-2606-001, amount=1000, date=2026-06-07',
        }]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { totalAmount: null } }),
      },
      historicalPartTimePayrollLink: { findMany: jest.fn().mockResolvedValue([{ ledgerEntry: { amount: d(1265) } }]) },
      account: { findFirst: jest.fn().mockResolvedValue({ id: 'expense-004' }) },
      company: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }) },
      auditLog: {
        findUnique: jest.fn().mockImplementation(() => Promise.resolve(audit)),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => { audit = data; return Promise.resolve(data); }),
      },
    };
    const prisma = { withTenant: jest.fn().mockImplementation((fn: (transaction: unknown) => unknown) => fn(tx)) };
    const accounting = {
      cancelProvenDirectAdvancePayrollDuplicateLedgerRowsInTransaction: jest.fn().mockImplementation(() => {
        ledger.status = 'cancelled';
        return Promise.resolve({ count: 1 });
      }),
    };
    const service = new HrPayrollDirectAdvanceCorrectionService(prisma as never, accounting as never);
    const command = { targetMonth: '2026-05', sourceRunNumber: 'PR-2606-001', ledgerEntryIds: ['ledger-1'] };

    const preview = await service.preview('company-1', command);
    expect(preview).toMatchObject({ selectedLegacyTotal: 1000, ledgerPayrollCostBefore: 49091, ledgerPayrollCostAfter: 48091, differenceAfter: 0 });
    expect(accounting.cancelProvenDirectAdvancePayrollDuplicateLedgerRowsInTransaction).not.toHaveBeenCalled();

    const result = await service.confirm('company-1', 'owner-1', {
      ...command, previewHash: preview.previewHash, idempotencyKey: 'direct-advance-may-1000',
      reason: 'Cancel the proven duplicate payroll cost for the exact advance and payroll run.',
      confirmation: 'CANCEL_PROVEN_DIRECT_ADVANCE_PAYROLL_DUPLICATE',
    });
    expect(result).toMatchObject({ cancelledCount: 1, cancelledTotal: 1000, differenceAfter: 0 });
    expect(ledger.status).toBe('cancelled');
    expect(accounting.cancelProvenDirectAdvancePayrollDuplicateLedgerRowsInTransaction).toHaveBeenCalledWith(tx, 'company-1', ['ledger-1']);
    expect(tx.auditLog.create).toHaveBeenCalled();
  });
});

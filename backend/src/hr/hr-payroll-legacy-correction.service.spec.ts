import { Prisma } from '@prisma/client';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { HRController } from './hr.controller';
import { HrPayrollLegacyCorrectionService } from './hr-payroll-legacy-correction.service';

const d = (value: number) => new Prisma.Decimal(value);

function setup(options: {
  rowCount?: number;
  afterLedgerTotal?: number;
  extraEligibleRow?: boolean;
  malformedLegacyNote?: boolean;
} = {}) {
  const rowCount = options.rowCount ?? 27;
  const sourceRun = {
    id: 'run-july', companyId: 'shami', runNumber: 'PR-2607-001', status: 'completed',
    payrollMonth: new Date('2026-07-01T00:00:00.000Z'), totalAmount: d(34951),
    items: [{ id: 'item-1', employeeId: 'employee-1', advancesDeduct: d(13100) }],
  };
  const candidateAmounts = Array.from({ length: rowCount }, (_, index) => index === rowCount - 1
    ? 13100 - (rowCount - 1) * 500
    : 500);
  const candidates = candidateAmounts.map((amount, index) => ({
    id: `legacy-ledger-${index + 1}`, companyId: 'shami', referenceType: 'advance_settlement',
    referenceId: `legacy-deduction-${index + 1}`, employeeId: 'employee-1', amount: d(amount),
    transactionDate: new Date('2026-07-06T00:00:00.000Z'), status: 'active', vaultId: null,
    debitAccount: { code: 'EXP-004' }, creditAccount: { code: 'ADV-001' }, payrollAdvanceSettlements: [],
  }));
  if (options.extraEligibleRow) candidates.push({
    id: 'legacy-ledger-extra', companyId: 'shami', referenceType: 'advance_settlement',
    referenceId: 'legacy-deduction-extra', employeeId: 'employee-1', amount: d(100),
    transactionDate: new Date('2026-07-06T00:00:00.000Z'), status: 'active', vaultId: null,
    debitAccount: { code: 'EXP-004' }, creditAccount: { code: 'ADV-001' }, payrollAdvanceSettlements: [],
  });
  const repairLedger = {
    id: 'repair-ledger-1', companyId: 'shami', referenceType: 'advance_settlement',
    referenceId: 'repair-deduction-1', employeeId: 'employee-1', amount: d(13100),
    transactionDate: new Date('2026-06-30T00:00:00.000Z'), status: 'active', vaultId: null,
    debitAccount: { code: 'EXP-004' }, creditAccount: { code: 'ADV-001' },
  };
  const legacyDeductions = candidates.map((candidate, index) => ({
    id: candidate.referenceId, companyId: 'shami', employeeId: 'employee-1', deductionType: 'advance',
    amount: candidate.amount,
    notes: options.malformedLegacyNote && index === 0
      ? `نص عام PR-2607-001 و ADV-${String(index + 1).padStart(3, '0')}`
      : `خصم سلفة تلقائي من مسير PR-2607-001 - سلفة ADV-${String(index + 1).padStart(3, '0')}`,
    referenceId: `advance-${index + 1}`,
  }));
  const repairDeduction = {
    id: 'repair-deduction-1', companyId: 'shami', employeeId: 'employee-1', deductionType: 'advance',
    amount: d(13100), notes: '[PAYROLL_COST_GAP_REPAIR_V2] run=PR-2607-001, payrollItem=item-1, nonCash=true',
    referenceId: null,
  };
  let audit: Record<string, unknown> | null = null;
  const invoiceUpdate = jest.fn();
  const deductionUpdate = jest.fn();
  const payrollUpdate = jest.fn();
  const vaultUpdate = jest.fn();
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
    payrollRun: {
      findFirst: jest.fn().mockResolvedValue(sourceRun),
      findMany: jest.fn().mockResolvedValue([sourceRun]),
      update: payrollUpdate,
    },
    ledgerEntry: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { id?: { in: string[] }; referenceId?: { in: string[] } } }) => {
        if (where.id?.in) return Promise.resolve(candidates.filter((row) => where.id!.in.includes(row.id)));
        if (!where.id && !where.referenceId) return Promise.resolve(candidates);
        if (where.referenceId?.in) return Promise.resolve(where.referenceId.in.includes(repairDeduction.id) ? [repairLedger] : []);
        return Promise.resolve([]);
      }),
      aggregate: jest.fn().mockImplementation(() => Promise.resolve({
        _sum: { amount: candidates.some((row) => row.status === 'active') ? d(61151) : d(options.afterLedgerTotal ?? 48051) },
      })),
      updateMany: jest.fn().mockImplementation(({ where }: { where: { id: { in: string[] }; status: string } }) => {
        const rows = candidates.filter((row) => where.id.in.includes(row.id) && row.status === 'active');
        if (where.status !== 'active') return Promise.resolve({ count: 0 });
        rows.forEach((row) => { row.status = 'cancelled'; });
        return Promise.resolve({ count: rows.length });
      }),
    },
    employeeDeduction: {
      findMany: jest.fn().mockImplementation(({ where }: { where: { id?: { in: string[] }; OR?: unknown[] } }) =>
        Promise.resolve(where.id?.in ? legacyDeductions.filter((row) => where.id!.in.includes(row.id)) : where.OR ? [repairDeduction] : [])),
      update: deductionUpdate,
    },
    invoice: {
      findMany: jest.fn().mockResolvedValue(legacyDeductions.map((row, index) => ({
        id: row.referenceId, employeeId: 'employee-1', invoiceNumber: `ADV-${String(index + 1).padStart(3, '0')}`,
      }))),
      update: invoiceUpdate,
    },
    account: { findFirst: jest.fn().mockResolvedValue({ id: 'salary-account' }) },
    company: { findUnique: jest.fn().mockResolvedValue({ tenantId: 'tenant-1' }) },
    vault: { update: vaultUpdate },
    auditLog: {
      findUnique: jest.fn().mockImplementation(() => Promise.resolve(audit)),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        audit = data;
        return Promise.resolve(data);
      }),
    },
  };
  const prisma = {
    $transaction: jest.fn().mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const accountingCancel = jest.fn().mockImplementation((
    _tx: unknown,
    _companyId: string,
    ledgerEntryIds: string[],
  ) => {
    const rows = candidates.filter((row) => ledgerEntryIds.includes(row.id) && row.status === 'active');
    rows.forEach((row) => { row.status = 'cancelled'; });
    return Promise.resolve({ count: rows.length });
  });
  return {
    service: new HrPayrollLegacyCorrectionService(prisma as never, {
      cancelProvenPayrollLegacyLedgerRowsInTransaction: accountingCancel,
    } as never),
    tx, candidates, accountingCancel, invoiceUpdate, deductionUpdate, payrollUpdate, vaultUpdate,
  };
}

describe('HrPayrollLegacyCorrectionService', () => {
  const base = {
    targetMonth: '2026-07', sourceRunNumber: 'PR-2607-001',
    ledgerEntryIds: Array.from({ length: 27 }, (_, index) => `legacy-ledger-${index + 1}`),
  };

  it('previews without mutation, then cancels only the proven ledger row with an audit record', async () => {
    const ctx = setup();
    const preview = await ctx.service.preview('shami', base);
    expect(preview).toMatchObject({ selectedLegacyTotal: 13100, differenceAfter: 0, candidateCount: 27 });
    expect(ctx.accountingCancel).not.toHaveBeenCalled();

    const result = await ctx.service.confirm('shami', 'owner-1', {
      ...base,
      previewHash: preview.previewHash,
      idempotencyKey: 'july-shami-duplicate-v1',
      reason: 'إلغاء قيود تسوية سلف مكررة ومثبتة بالمراجعة',
      confirmation: 'CANCEL_CONFIRMED_PAYROLL_DUPLICATES',
    });
    expect(result).toMatchObject({ cancelledCount: 27, cancelledTotal: 13100, differenceAfter: 0, replayed: false });
    expect(ctx.candidates.every((row) => row.status === 'cancelled')).toBe(true);
    expect(ctx.accountingCancel).toHaveBeenCalledWith(
      ctx.tx,
      'shami',
      base.ledgerEntryIds.slice().sort(),
    );
    expect(ctx.tx.ledgerEntry.updateMany).not.toHaveBeenCalled();
    expect(ctx.tx.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'cancel', userId: 'owner-1' }),
    }));
    expect(ctx.invoiceUpdate).not.toHaveBeenCalled();
    expect(ctx.deductionUpdate).not.toHaveBeenCalled();
    expect(ctx.payrollUpdate).not.toHaveBeenCalled();
    expect(ctx.vaultUpdate).not.toHaveBeenCalled();
  });

  it('replays the permanent audit result without cancelling twice', async () => {
    const ctx = setup();
    const preview = await ctx.service.preview('shami', base);
    const command = {
      ...base, previewHash: preview.previewHash, idempotencyKey: 'july-shami-duplicate-v1',
      reason: 'إلغاء قيود تسوية سلف مكررة ومثبتة بالمراجعة',
      confirmation: 'CANCEL_CONFIRMED_PAYROLL_DUPLICATES' as const,
    };
    await ctx.service.confirm('shami', 'owner-1', command);
    const replay = await ctx.service.confirm('shami', 'owner-1', command);
    expect(replay).toMatchObject({ replayed: true, cancelledCount: 27 });
    expect(ctx.accountingCancel).toHaveBeenCalledTimes(1);
  });

  it('exposes preview and confirm to owner only', () => {
    expect(Reflect.getMetadata(ROLES_KEY, HRController.prototype.previewPayrollLegacyCorrection)).toEqual(['owner']);
    expect(Reflect.getMetadata(ROLES_KEY, HRController.prototype.confirmPayrollLegacyCorrection)).toEqual(['owner']);
  });

  it('rejects a stale preview hash before any update', async () => {
    const ctx = setup();
    await expect(ctx.service.confirm('shami', 'owner-1', {
      ...base, previewHash: '0'.repeat(64), idempotencyKey: 'july-shami-stale-v1',
      reason: 'إلغاء قيود تسوية سلف مكررة ومثبتة بالمراجعة',
      confirmation: 'CANCEL_CONFIRMED_PAYROLL_DUPLICATES',
    })).rejects.toThrow('تغيّرت بيانات المطابقة');
    expect(ctx.accountingCancel).not.toHaveBeenCalled();
  });

  it('rejects an omitted eligible row because the server derives the full set', async () => {
    const ctx = setup({ extraEligibleRow: true });
    await expect(ctx.service.preview('shami', base)).rejects.toThrow('كامل مجموعة التكرار المؤهلة');
    expect(ctx.accountingCancel).not.toHaveBeenCalled();
  });

  it('does not accept loose run/invoice mentions outside the exact legacy note format', async () => {
    const ctx = setup({ malformedLegacyNote: true });
    await expect(ctx.service.preview('shami', base)).rejects.toThrow('كامل مجموعة التكرار المؤهلة');
    expect(ctx.accountingCancel).not.toHaveBeenCalled();
  });

  it('rejects an ID outside the server-derived company set', async () => {
    const ctx = setup();
    await expect(ctx.service.preview('shami', {
      ...base, ledgerEntryIds: [...base.ledgerEntryIds, 'foreign-company-ledger'],
    })).rejects.toThrow('كامل مجموعة التكرار المؤهلة');
    expect(ctx.accountingCancel).not.toHaveBeenCalled();
  });

  it('aborts the transaction contract when the post-cancellation difference is not zero', async () => {
    const ctx = setup({ afterLedgerTotal: 48052 });
    const preview = await ctx.service.preview('shami', base);
    await expect(ctx.service.confirm('shami', 'owner-1', {
      ...base, previewHash: preview.previewHash, idempotencyKey: 'july-shami-rollback-v1',
      reason: 'إلغاء قيود تسوية سلف مكررة ومثبتة بالمراجعة',
      confirmation: 'CANCEL_CONFIRMED_PAYROLL_DUPLICATES',
    })).rejects.toThrow('المطابقة الصفرية');
    expect(ctx.tx.auditLog.create).not.toHaveBeenCalled();
  });
});

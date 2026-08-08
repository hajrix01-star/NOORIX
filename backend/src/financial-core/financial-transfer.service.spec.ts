import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FinancialTransferService } from './financial-transfer.service';

const baseDto = {
  companyId: 'company-1',
  fromVaultId: 'cash',
  toVaultId: 'bank',
  amount: '125.5000',
  transactionDate: '2026-08-08',
  notes: 'deposit',
  idempotencyKey: 'transfer-attempt-0001',
};

function createHarness() {
  let createdTransfer: Record<string, unknown> | null = null;
  let createdLedger: Record<string, unknown> | null = null;
  const tx = {
    vaultTransfer: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => {
        createdTransfer = { id: 'transfer-1', ledgerEntry: null, ...data };
        return createdTransfer;
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        if (where.id === 'transfer-1') {
          createdTransfer = { ...createdTransfer, ...data, ledgerEntry: createdLedger };
          return createdTransfer;
        }
        return { id: where.id, ...data };
      }),
    },
    ledgerEntry: {
      create: jest.fn().mockImplementation(({ data }) => {
        createdLedger = { id: 'ledger-1', ...data };
        return createdLedger;
      }),
    },
    auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
  };
  const db = {
    withTenant: jest.fn().mockImplementation((callback) => callback(tx)),
    vaultTransfer: { findFirst: jest.fn() },
  };
  const fiscal = { assertPeriodOpenForDate: jest.fn().mockResolvedValue(undefined) };
  const support = {
    withRetry: jest.fn().mockImplementation((callback) => callback()),
    resolveUserId: jest.fn().mockReturnValue('user-1'),
    resolveTenantId: jest.fn().mockReturnValue('tenant-1'),
    assertVaultTransferEndpoints: jest.fn().mockResolvedValue(undefined),
    assertVaultTransferReversalEndpoints: jest.fn().mockResolvedValue(undefined),
    getVaultAccount: jest.fn().mockImplementation((_tx, _companyId, vaultId) =>
      Promise.resolve(vaultId === 'cash' ? 'account-cash' : 'account-bank')),
  };
  const service = new FinancialTransferService(db as never, fiscal as never, support as never);
  return { service, tx, db, fiscal, support, getTransfer: () => createdTransfer };
}

describe('FinancialTransferService', () => {
  it('posts one balanced voucher atomically and permits the source balance to become negative', async () => {
    const { service, tx, db } = createHarness();

    const result = await service.processTransfer(baseDto, 'user-1');

    expect(db.withTenant).toHaveBeenCalledTimes(1);
    expect(tx.ledgerEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        debitAccountId: 'account-bank',
        creditAccountId: 'account-cash',
        amount: expect.objectContaining({}),
        referenceType: 'transfer',
        referenceId: 'transfer-1',
        status: 'active',
      }),
    });
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
    expect(result.referenceId).toMatch(/^TRF-20260808-/);
    expect(result.ledgerEntry).toBeTruthy();
    expect((tx as Record<string, unknown>).vaultBalance).toBeUndefined();
  });

  it('replays the same request without creating a second ledger entry', async () => {
    const { service, tx, getTransfer } = createHarness();
    await service.processTransfer(baseDto, 'user-1');
    tx.vaultTransfer.findFirst.mockResolvedValue(getTransfer());

    const replay = await service.processTransfer(baseDto, 'user-1');

    expect(tx.ledgerEntry.create).toHaveBeenCalledTimes(1);
    expect(replay.transfer).toEqual(getTransfer());
  });

  it('rejects reuse of an idempotency key for a different payload', async () => {
    const { service, tx, getTransfer } = createHarness();
    await service.processTransfer(baseDto, 'user-1');
    tx.vaultTransfer.findFirst.mockResolvedValue(getTransfer());

    await expect(service.processTransfer({ ...baseDto, amount: '130' }, 'user-1'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(tx.ledgerEntry.create).toHaveBeenCalledTimes(1);
  });

  it('resolves the losing process of a database uniqueness race to the committed voucher', async () => {
    const winner = createHarness();
    const committed = (await winner.service.processTransfer(baseDto, 'user-1')).transfer;
    const loser = createHarness();
    const uniqueError = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002', clientVersion: '5.22.0', meta: {},
    });
    loser.db.withTenant.mockRejectedValue(uniqueError);
    loser.db.vaultTransfer.findFirst.mockResolvedValue(committed);

    const result = await loser.service.processTransfer(baseDto, 'user-1');

    expect(result.transfer).toBe(committed);
    expect(loser.tx.ledgerEntry.create).not.toHaveBeenCalled();
  });

  it('rejects an amount that rounds to zero before reaching the database', async () => {
    const { service, db } = createHarness();
    await expect(service.processTransfer({ ...baseDto, amount: '0.00001' }, 'user-1'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(db.withTenant).not.toHaveBeenCalled();
  });

  it('does not swallow a transactional audit failure', async () => {
    const { service, tx } = createHarness();
    tx.auditLog.create.mockRejectedValue(new Error('audit failed'));
    await expect(service.processTransfer(baseDto, 'user-1')).rejects.toThrow('audit failed');
  });

  it('creates an opposite immutable voucher when reversing a transfer', async () => {
    const { service, tx } = createHarness();
    const original = {
      id: 'original-1', companyId: 'company-1', transferNumber: 'TRF-1',
      fromVaultId: 'cash', toVaultId: 'bank', amount: new Prisma.Decimal('125.5'),
      transactionDate: new Date('2026-08-08T00:00:00.000Z'), status: 'posted',
      reversalOfId: null, reversal: null, ledgerEntry: { id: 'old-ledger' }, requestHash: 'old',
    };
    tx.vaultTransfer.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(original);
    tx.vaultTransfer.create.mockImplementation(({ data }) => ({
      id: 'transfer-1', ledgerEntry: null, ...data,
    }));

    await service.reverseTransfer({
      companyId: 'company-1', transferId: 'original-1', transactionDate: '2026-08-09',
      reason: 'correction', idempotencyKey: 'reverse-attempt-0001',
    }, 'user-1');

    expect(tx.vaultTransfer.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      fromVaultId: 'bank', toVaultId: 'cash', reversalOfId: 'original-1', status: 'posted',
    }) });
    expect(tx.ledgerEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      debitAccountId: 'account-cash', creditAccountId: 'account-bank', referenceType: 'transfer',
    }) });
    expect(tx.vaultTransfer.update).toHaveBeenCalledWith({
      where: { id: 'original-1' }, data: expect.objectContaining({ status: 'reversed' }),
    });
  });

  it('rejects a reversal dated before its original transfer', async () => {
    const { service, tx, fiscal } = createHarness();
    tx.vaultTransfer.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'original-1', fromVaultId: 'cash', toVaultId: 'bank', amount: new Prisma.Decimal(5),
      transactionDate: new Date('2026-08-08T00:00:00.000Z'), status: 'posted',
      reversalOfId: null, reversal: null, ledgerEntry: {}, requestHash: 'old', transferNumber: 'TRF-1',
    });

    await expect(service.reverseTransfer({
      companyId: 'company-1', transferId: 'original-1', transactionDate: '2026-08-07',
      idempotencyKey: 'reverse-attempt-0002',
    }, 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(fiscal.assertPeriodOpenForDate).not.toHaveBeenCalled();
  });

  it('replays the same reversal key and rejects a changed reversal payload', async () => {
    const { service, tx } = createHarness();
    const original = {
      id: 'original-1', companyId: 'company-1', transferNumber: 'TRF-1',
      fromVaultId: 'cash', toVaultId: 'bank', amount: new Prisma.Decimal('25'),
      transactionDate: new Date('2026-08-08T00:00:00.000Z'), status: 'posted',
      reversalOfId: null, reversal: null, ledgerEntry: { id: 'old-ledger' }, requestHash: 'old',
    };
    tx.vaultTransfer.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(original);
    const dto = {
      companyId: 'company-1', transferId: 'original-1', transactionDate: '2026-08-09',
      reason: 'correction', idempotencyKey: 'reverse-attempt-replay',
    };
    const first = await service.reverseTransfer(dto, 'user-1');
    tx.vaultTransfer.findFirst.mockReset().mockResolvedValue(first.transfer);

    const replay = await service.reverseTransfer(dto, 'user-1');
    expect(replay.transfer).toBe(first.transfer);
    expect(tx.ledgerEntry.create).toHaveBeenCalledTimes(1);
    await expect(service.reverseTransfer({ ...dto, reason: 'different' }, 'user-1'))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('turns a competing second reversal into a stable conflict', async () => {
    const { service, db } = createHarness();
    db.withTenant.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('duplicate reversal', {
      code: 'P2002', clientVersion: '5.22.0', meta: {},
    }));
    db.vaultTransfer.findFirst.mockResolvedValue(null);

    await expect(service.reverseTransfer({
      companyId: 'company-1', transferId: 'original-1', transactionDate: '2026-08-09',
      idempotencyKey: 'different-reversal-key',
    }, 'user-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it.each([
    [{ ...baseDto, fromVaultId: 'cash', toVaultId: 'cash' }, BadRequestException],
    [{ ...baseDto, transactionDate: '2026-02-30' }, BadRequestException],
    [{ ...baseDto, amount: 'not-a-number' }, BadRequestException],
  ])('rejects invalid transfer input before opening a transaction', async (dto, errorType) => {
    const { service, db } = createHarness();
    await expect(service.processTransfer(dto, 'user-1')).rejects.toBeInstanceOf(errorType);
    expect(db.withTenant).not.toHaveBeenCalled();
  });

  it('honors the fiscal-period guard before posting', async () => {
    const { service, fiscal, tx } = createHarness();
    fiscal.assertPeriodOpenForDate.mockRejectedValue(new BadRequestException('closed'));
    await expect(service.processTransfer(baseDto, 'user-1')).rejects.toThrow('closed');
    expect(tx.ledgerEntry.create).not.toHaveBeenCalled();
  });
});

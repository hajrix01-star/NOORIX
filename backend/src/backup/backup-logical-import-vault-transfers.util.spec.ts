import { Prisma } from '@prisma/client';
import { importBackupLogicalVaultTransfers } from './backup-logical-import-vault-transfers.util';

describe('importBackupLogicalVaultTransfers', () => {
  it('restores original and reversal vouchers with remapped vaults, ledgers, notes and chain', async () => {
    const vaultTransferCreate = jest.fn().mockResolvedValue({});
    const vaultTransferUpdate = jest.fn().mockResolvedValue({});
    const auditCreate = jest.fn().mockResolvedValue({});
    const tx = {
      vaultTransfer: { create: vaultTransferCreate, update: vaultTransferUpdate },
      auditLog: { create: auditCreate },
    };
    let sequence = 0;
    const data = {
      vaultTransfers: [
        {
          id: 'old-transfer', transferNumber: 'TRF-1', fromVaultId: 'old-cash', toVaultId: 'old-bank',
          amount: new Prisma.Decimal('500'), transactionDate: new Date('2026-08-01'),
          entryDate: new Date('2026-08-01'), notes: 'original note', status: 'reversed',
          idempotencyKey: 'key-original', requestHash: 'hash-original', ledgerEntryId: 'old-ledger-1',
          reversedAt: new Date('2026-08-02'), createdAt: new Date('2026-08-01'), updatedAt: new Date('2026-08-02'),
        },
        {
          id: 'old-reversal', transferNumber: 'TRV-1', fromVaultId: 'old-bank', toVaultId: 'old-cash',
          amount: new Prisma.Decimal('500'), transactionDate: new Date('2026-08-02'),
          entryDate: new Date('2026-08-02'), notes: 'reversal reason', status: 'posted',
          idempotencyKey: 'key-reversal', requestHash: 'hash-reversal', ledgerEntryId: 'old-ledger-2',
          reversalOfId: 'old-transfer', createdAt: new Date('2026-08-02'), updatedAt: new Date('2026-08-02'),
        },
      ],
    };

    const map = await importBackupLogicalVaultTransfers(tx as never, {
      tenantId: 'tenant-1',
      newCompanyId: 'new-company',
      data,
      importingUserId: 'import-user',
      nid: () => `new-${++sequence}`,
      vaultMap: new Map([['old-cash', 'new-cash'], ['old-bank', 'new-bank']]),
      ledgerEntryMap: new Map([['old-ledger-1', 'new-ledger-1'], ['old-ledger-2', 'new-ledger-2']]),
      transferMap: new Map([['old-transfer', 'new-transfer'], ['old-reversal', 'new-reversal']]),
    });

    expect(map).toEqual(new Map([['old-transfer', 'new-transfer'], ['old-reversal', 'new-reversal']]));
    expect(vaultTransferCreate).toHaveBeenNthCalledWith(1, { data: expect.objectContaining({
      id: 'new-transfer', fromVaultId: 'new-cash', toVaultId: 'new-bank', ledgerEntryId: 'new-ledger-1',
      notes: 'original note', status: 'reversed',
    }) });
    expect(vaultTransferCreate).toHaveBeenNthCalledWith(2, { data: expect.objectContaining({
      id: 'new-reversal', fromVaultId: 'new-bank', toVaultId: 'new-cash', ledgerEntryId: 'new-ledger-2',
      notes: 'reversal reason',
    }) });
    expect(vaultTransferUpdate).toHaveBeenCalledWith({
      where: { id: 'new-reversal' }, data: { reversalOfId: 'new-transfer' },
    });
    expect(auditCreate).toHaveBeenCalledTimes(2);
  });

  it('fails closed when a voucher endpoint or ledger cannot be remapped', async () => {
    const tx = {
      vaultTransfer: { create: jest.fn(), update: jest.fn() },
      ledgerEntry: { update: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    await expect(importBackupLogicalVaultTransfers(tx as never, {
      tenantId: 'tenant-1', newCompanyId: 'new-company', importingUserId: 'import-user',
      nid: () => 'new-id', vaultMap: new Map(), ledgerEntryMap: new Map(), transferMap: new Map(),
      data: { vaultTransfers: [{ id: 'orphan', fromVaultId: 'a', toVaultId: 'b', ledgerEntryId: 'l' }] },
    })).rejects.toThrow('VAULT_TRANSFER_RESTORE_REFERENCE_MISSING:orphan');
    expect(tx.vaultTransfer.create).not.toHaveBeenCalled();
  });

  it('fails closed when a reversal chain target cannot be remapped', async () => {
    const tx = {
      vaultTransfer: { create: jest.fn().mockResolvedValue({}), update: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const row = {
      id: 'reversal', transferNumber: 'TRV-1', fromVaultId: 'b', toVaultId: 'a', amount: 10,
      transactionDate: new Date(), entryDate: new Date(), status: 'posted',
      idempotencyKey: 'key', requestHash: 'hash', ledgerEntryId: 'ledger',
      reversalOfId: 'missing-original', createdAt: new Date(), updatedAt: new Date(),
    };
    await expect(importBackupLogicalVaultTransfers(tx as never, {
      tenantId: 'tenant-1', newCompanyId: 'new-company', importingUserId: 'import-user',
      nid: () => 'audit-id',
      vaultMap: new Map([['a', 'new-a'], ['b', 'new-b']]),
      ledgerEntryMap: new Map([['ledger', 'new-ledger']]),
      transferMap: new Map([['reversal', 'new-reversal']]),
      data: { vaultTransfers: [row] },
    })).rejects.toThrow('VAULT_TRANSFER_RESTORE_REVERSAL_REFERENCE_MISSING:reversal');
    expect(tx.vaultTransfer.update).not.toHaveBeenCalled();
  });
});

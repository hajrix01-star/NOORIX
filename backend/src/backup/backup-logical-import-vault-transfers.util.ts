import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  importSnapshotArr as arr,
  importSnapshotDec as dec,
  importSnapshotDdate as ddate,
} from './backup-logical-import-helpers.util';

type Params = {
  tenantId: string;
  newCompanyId: string;
  data: Record<string, unknown>;
  importingUserId: string;
  nid: () => string;
  vaultMap: Map<string, string>;
  ledgerEntryMap: Map<string, string>;
  transferMap: Map<string, string>;
};

/** Restores the operational voucher layer and remaps its immutable-ledger links. */
export async function importBackupLogicalVaultTransfers(
  tx: Prisma.TransactionClient,
  p: Params,
): Promise<Map<string, string>> {
  const { tenantId, newCompanyId, data, importingUserId, nid, vaultMap, ledgerEntryMap, transferMap } = p;
  const transferRows = arr<Record<string, unknown>>(data.vaultTransfers);

  for (const row of transferRows) {
    const fromVaultId = vaultMap.get(String(row.fromVaultId));
    const toVaultId = vaultMap.get(String(row.toVaultId));
    const ledgerEntryId = row.ledgerEntryId
      ? ledgerEntryMap.get(String(row.ledgerEntryId))
      : undefined;
    // Fail closed: silently dropping a voucher would leave a valid ledger balance
    // without its operational document and would break audit/reversal workflows.
    const id = transferMap.get(String(row.id));
    if (!id || !fromVaultId || !toVaultId || !ledgerEntryId) {
      throw new BadRequestException(`VAULT_TRANSFER_RESTORE_REFERENCE_MISSING:${String(row.id)}`);
    }
    await tx.vaultTransfer.create({
      data: {
        id,
        tenantId,
        companyId: newCompanyId,
        transferNumber: String(row.transferNumber),
        fromVaultId,
        toVaultId,
        amount: dec(row.amount),
        transactionDate: ddate(row.transactionDate),
        entryDate: ddate(row.entryDate),
        notes: (row.notes as string | null) ?? null,
        status: String(row.status ?? 'posted'),
        idempotencyKey: String(row.idempotencyKey),
        requestHash: String(row.requestHash),
        ledgerEntryId,
        reversedAt: row.reversedAt ? ddate(row.reversedAt) : null,
        createdById: importingUserId,
        createdAt: ddate(row.createdAt),
        updatedAt: ddate(row.updatedAt),
      },
    });
    await tx.auditLog.create({
      data: {
        id: nid(),
        tenantId,
        companyId: newCompanyId,
        userId: importingUserId,
        action: 'restore',
        entity: 'vault_transfer',
        entityId: id,
        newValue: {
          transferNumber: String(row.transferNumber),
          sourceSnapshotId: String(row.id),
          ledgerEntryId,
        },
        createdAt: new Date(),
      },
    });
  }

  for (const row of transferRows) {
    if (!row.reversalOfId) continue;
    const id = transferMap.get(String(row.id));
    const reversalOfId = transferMap.get(String(row.reversalOfId));
    if (!id || !reversalOfId) {
      throw new BadRequestException(
        `VAULT_TRANSFER_RESTORE_REVERSAL_REFERENCE_MISSING:${String(row.id)}`,
      );
    }
    await tx.vaultTransfer.update({ where: { id }, data: { reversalOfId } });
  }

  return transferMap;
}

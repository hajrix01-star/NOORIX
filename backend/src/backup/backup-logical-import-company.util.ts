import { Prisma } from '@prisma/client';
import { importSnapshotDec as dec } from './backup-logical-import-helpers.util';
import { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';

export async function createImportedCompany(
  tx: Prisma.TransactionClient,
  p: Pick<
    BackupLogicalImportTxParams,
    'tenantId' | 'newCompanyId' | 'nameAr' | 'resolvedNameEn' | 'co'
  >,
): Promise<void> {
  const { tenantId, newCompanyId, nameAr, resolvedNameEn, co } = p;
  const lastCompany = await tx.company.aggregate({
    where: { tenantId, isArchived: false },
    _max: { sortOrder: true },
  });

  await tx.company.create({
    data: {
      id: newCompanyId,
      tenantId,
      nameAr,
      nameEn: resolvedNameEn,
      logoUrl: (co.logoUrl as string | null) ?? null,
      phone: (co.phone as string | null) ?? null,
      address: (co.address as string | null) ?? null,
      taxNumber: (co.taxNumber as string | null) ?? null,
      email: (co.email as string | null) ?? null,
      isArchived: false,
      vatEnabledForSales: Boolean(co.vatEnabledForSales),
      vatRatePercent: dec(co.vatRatePercent ?? 15),
      salesShiftsEnabled: Boolean(co.salesShiftsEnabled),
      sortOrder: (lastCompany._max.sortOrder ?? 0) + 1,
    },
  });
}

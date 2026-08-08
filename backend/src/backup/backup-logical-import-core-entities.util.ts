import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  importSnapshotArr as arr,
  importSnapshotDec as dec,
  importSnapshotDdate as ddate,
} from './backup-logical-import-helpers.util';
import { createImportedCompany } from './backup-logical-import-company.util';
import { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';
import { inferBankReconciliationEnabled } from '../vaults/vault-bank-reconciliation.util';

export type BackupLogicalImportCoreMaps = {
  accountMap: Map<string, string>;
  categoryMap: Map<string, string>;
  supplierMap: Map<string, string>;
  vaultMap: Map<string, string>;
  expenseLineMap: Map<string, string>;
  employeeMap: Map<string, string>;
};

export async function importBackupLogicalCoreEntities(
  tx: Prisma.TransactionClient,
  p: BackupLogicalImportTxParams,
): Promise<BackupLogicalImportCoreMaps> {
  const { tenantId, newCompanyId, data, nameAr, resolvedNameEn, co, nid } = p;
  await createImportedCompany(tx, { tenantId, newCompanyId, nameAr, resolvedNameEn, co });

  const accountMap = new Map<string, string>();
  for (const a of arr<Record<string, unknown>>(data.accounts)) {
    const id = nid();
    accountMap.set(String(a.id), id);
    await tx.account.create({
      data: {
        id,
        tenantId,
        companyId: newCompanyId,
        code: String(a.code),
        nameAr: String(a.nameAr),
        nameEn: (a.nameEn as string | null) ?? null,
        type: String(a.type),
        icon: (a.icon as string | null) ?? null,
        taxExempt: Boolean(a.taxExempt),
        isActive: a.isActive !== false,
        createdAt: ddate(a.createdAt),
        updatedAt: ddate(a.updatedAt),
      },
    });
  }

  const categoryMap = new Map<string, string>();
  let catRemaining = arr<Record<string, unknown>>(data.categories);
  while (catRemaining.length) {
    const batch = catRemaining.filter((c) => {
      const p = c.parentId as string | null | undefined;
      return !p || categoryMap.has(String(p));
    });
    if (!batch.length) {
      throw new BadRequestException('تعذّر ترتيب فئات ذات تبعية دائرية');
    }
    for (const c of batch) {
      const id = nid();
      categoryMap.set(String(c.id), id);
      const accId = c.accountId ? accountMap.get(String(c.accountId)) : undefined;
      const parentId = c.parentId ? categoryMap.get(String(c.parentId)) : undefined;
      await tx.category.create({
        data: {
          id,
          tenantId,
          companyId: newCompanyId,
          accountId: accId ?? null,
          nameAr: String(c.nameAr),
          nameEn: (c.nameEn as string | null) ?? null,
          parentId: parentId ?? null,
          type: String(c.type ?? 'purchase'),
          icon: (c.icon as string | null) ?? null,
          isActive: c.isActive !== false,
          sortOrder: Number(c.sortOrder ?? 0),
          createdAt: ddate(c.createdAt),
          updatedAt: ddate(c.updatedAt),
        },
      });
    }
    const done = new Set(batch.map((c) => String(c.id)));
    catRemaining = catRemaining.filter((c) => !done.has(String(c.id)));
  }

  const supplierMap = new Map<string, string>();
  const directoryCodes = new Set(
    (await tx.supplierDirectoryEntry.findMany({ select: { id: true } }))
      .map((entry) => entry.id),
  );
  for (const s of arr<Record<string, unknown>>(data.suppliers)) {
    const id = nid();
    supplierMap.set(String(s.id), id);
    const sc = s.supplierCategoryId ? categoryMap.get(String(s.supplierCategoryId)) : undefined;
    const directoryEntryId = typeof s.directoryEntryId === 'string'
      && directoryCodes.has(s.directoryEntryId)
      ? s.directoryEntryId
      : null;
    await tx.supplier.create({
      data: {
        id,
        tenantId,
        companyId: newCompanyId,
        nameAr: String(s.nameAr),
        nameEn: (s.nameEn as string | null) ?? null,
        phone: (s.phone as string | null) ?? null,
        taxNumber: (s.taxNumber as string | null) ?? null,
        categoryId: (s.categoryId as string | null) ?? null,
        supplierCategoryId: sc ?? null,
        directoryEntryId,
        directoryManaged: directoryEntryId ? Boolean(s.directoryManaged) : false,
        isTaxRegistered: s.isTaxRegistered !== false,
        isBookmarked: Boolean(s.isBookmarked),
        isDeleted: Boolean(s.isDeleted),
        createdAt: ddate(s.createdAt),
        updatedAt: ddate(s.updatedAt),
      },
    });
  }

  const vaultMap = new Map<string, string>();
  for (const v of arr<Record<string, unknown>>(data.vaults)) {
    const id = nid();
    vaultMap.set(String(v.id), id);
    const aid = accountMap.get(String(v.accountId));
    if (!aid) throw new BadRequestException('خزنة بدون حساب مطابق');
    await tx.vault.create({
      data: {
        id,
        tenantId,
        companyId: newCompanyId,
        accountId: aid,
        nameAr: String(v.nameAr),
        nameEn: (v.nameEn as string | null) ?? null,
        type: String(v.type),
        isActive: v.isActive !== false,
        isArchived: Boolean(v.isArchived),
        isSalesChannel: Boolean(v.isSalesChannel),
        showAsPaymentMethod: (v as { showAsPaymentMethod?: boolean }).showAsPaymentMethod !== false,
        paymentMethod: (v.paymentMethod as string | null) ?? null,
        bankReconciliationEnabled: typeof v.bankReconciliationEnabled === 'boolean'
          ? v.bankReconciliationEnabled
          : inferBankReconciliationEnabled({
              type: v.type as string | null,
              nameAr: v.nameAr as string | null,
              nameEn: v.nameEn as string | null,
              paymentMethod: v.paymentMethod as string | null,
            }),
        notes: (v.notes as string | null) ?? null,
        sortOrder: typeof (v as { sortOrder?: unknown }).sortOrder === 'number'
          ? ((v as { sortOrder: number }).sortOrder)
          : 0,
        createdAt: ddate(v.createdAt),
        updatedAt: ddate(v.updatedAt),
      },
    });
  }

  const expenseLineMap = new Map<string, string>();
  for (const e of arr<Record<string, unknown>>(data.expenseLines)) {
    const id = nid();
    expenseLineMap.set(String(e.id), id);
    const cid = categoryMap.get(String(e.categoryId));
    const sid = supplierMap.get(String(e.supplierId));
    if (!cid || !sid) throw new BadRequestException('بند مصروف بفئة/مورد غير موجود');
    await tx.expenseLine.create({
      data: {
        id,
        tenantId,
        companyId: newCompanyId,
        nameAr: String(e.nameAr),
        nameEn: (e.nameEn as string | null) ?? null,
        kind: String(e.kind),
        categoryId: cid,
        supplierId: sid,
        serviceNumber: (e.serviceNumber as string | null) ?? null,
        notes: (e.notes as string | null) ?? null,
        isActive: e.isActive !== false,
        createdAt: ddate(e.createdAt),
        updatedAt: ddate(e.updatedAt),
      },
    });
  }

  const employeeMap = new Map<string, string>();
  for (const e of arr<Record<string, unknown>>(data.employees)) {
    const id = nid();
    employeeMap.set(String(e.id), id);
    await tx.employee.create({
      data: {
        id,
        tenantId,
        companyId: newCompanyId,
        employeeSerial: String(e.employeeSerial),
        name: String(e.name),
        nameEn: (e.nameEn as string | null) ?? null,
        iqamaNumber: (e.iqamaNumber as string | null) ?? null,
        jobTitle: (e.jobTitle as string | null) ?? null,
        basicSalary: dec(e.basicSalary),
        housingAllowance: dec(e.housingAllowance ?? 0),
        transportAllowance: dec(e.transportAllowance ?? 0),
        otherAllowance: dec(e.otherAllowance ?? 0),
        workHours: (e.workHours as string | null) ?? null,
        workSchedule: (e.workSchedule as string | null) ?? null,
        joinDate: ddate(e.joinDate),
        status: String(e.status ?? 'active'),
        notes: (e.notes as string | null) ?? null,
        createdAt: ddate(e.createdAt),
        updatedAt: ddate(e.updatedAt),
      },
    });
  }

  for (const f of arr<Record<string, unknown>>(data.fiscalPeriods)) {
    await tx.fiscalPeriod.create({
      data: {
        id: nid(),
        tenantId,
        companyId: newCompanyId,
        nameAr: String(f.nameAr),
        nameEn: (f.nameEn as string | null) ?? null,
        startDate: ddate(f.startDate),
        endDate: ddate(f.endDate),
        status: String(f.status ?? 'open'),
        closedAt: f.closedAt ? ddate(f.closedAt) : null,
        closedById: null,
        createdAt: ddate(f.createdAt),
        updatedAt: ddate(f.updatedAt),
      },
    });
  }


  return { accountMap, categoryMap, supplierMap, vaultMap, expenseLineMap, employeeMap };
}

import { Prisma } from '@prisma/client';
import {
  importSnapshotArr as arr,
  importSnapshotDec as dec,
  importSnapshotDdate as ddate,
} from './backup-logical-import-helpers.util';
import { BackupLogicalImportTxParams } from './backup-logical-import-transaction.types';
import { normalizeSalesDayContextSnapshotInput, salesDayContextJson } from '../sales/sales-day-context.util';
import { importBackupLogicalOrdersAndInventory } from './backup-logical-import-orders-inventory.util';

export type BackupLogicalImportOperationalMaps = {
  dailySalesSummaryMap: Map<string, string>;
  orderCategoryMap: Map<string, string>;
  orderProductMap: Map<string, string>;
  orderMap: Map<string, string>;
  bscatMap: Map<string, string>;
  bankStatementMap: Map<string, string>;
};

export async function importBackupLogicalOperationalRecords(
  tx: Prisma.TransactionClient,
  p: BackupLogicalImportTxParams,
  maps: {
    categoryMap: Map<string, string>;
    supplierMap: Map<string, string>;
    vaultMap: Map<string, string>;
  },
): Promise<BackupLogicalImportOperationalMaps> {
  const { tenantId, newCompanyId, data, importingUserId, nid } = p;
  const { categoryMap, supplierMap, vaultMap } = maps;
  const dailySalesSummaryMap = new Map<string, string>();
  for (const s of arr<Record<string, unknown>>(data.dailySalesSummaries)) {
    const id = nid();
    dailySalesSummaryMap.set(String(s.id), id);
    await tx.dailySalesSummary.create({
      data: {
        id,
        tenantId,
        companyId: newCompanyId,
        summaryNumber: String(s.summaryNumber),
        transactionDate: ddate(s.transactionDate),
        customerCount: Number(s.customerCount ?? 0),
        shift: s.shift === 'morning' || s.shift === 'evening' || s.shift === 'all' ? String(s.shift) : 'all',
        cashOnHand: dec(s.cashOnHand ?? 0),
        totalAmount: dec(s.totalAmount ?? 0),
        notes: (s.notes as string | null) ?? null,
        dayContext: salesDayContextJson(normalizeSalesDayContextSnapshotInput(s.dayContext)),
        status: String(s.status ?? 'active'),
        createdById: importingUserId,
        entryDate: ddate(s.entryDate),
        createdAt: ddate(s.createdAt),
        updatedAt: ddate(s.updatedAt),
      },
    });
  }

  for (const ch of arr<Record<string, unknown>>(data.dailySalesChannels)) {
    const sid = dailySalesSummaryMap.get(String(ch.summaryId));
    const vid = vaultMap.get(String(ch.vaultId));
    if (!sid || !vid) continue;
    await tx.dailySalesChannel.create({
      data: {
        id: nid(),
        summaryId: sid,
        vaultId: vid,
        amount: dec(ch.amount ?? 0),
      },
    });
  }

  const { orderCategoryMap, orderProductMap, orderMap } =
    await importBackupLogicalOrdersAndInventory(tx, p);

  const bscatMap = new Map<string, string>();
  for (const c of arr<Record<string, unknown>>(data.bankStatementCategories)) {
    const id = nid();
    bscatMap.set(String(c.id), id);
    await tx.bankStatementCategory.create({
      data: {
        id,
        companyId: newCompanyId,
        nameAr: String(c.nameAr),
        nameEn: (c.nameEn as string | null) ?? null,
        color: String(c.color ?? '#6366f1'),
        sortOrder: Number(c.sortOrder ?? 0),
        createdAt: ddate(c.createdAt),
      },
    });
  }

  for (const t of arr<Record<string, unknown>>(data.bankTreeCategories)) {
    await tx.bankTreeCategory.create({
      data: {
        id: nid(),
        tenantId,
        companyId: newCompanyId,
        name: String(t.name),
        sortOrder: Number(t.sortOrder ?? 100),
        isActive: t.isActive !== false,
        transactionSide: String(t.transactionSide ?? 'any'),
        transactionType: (t.transactionType as string | null) ?? null,
        parentKeywords: (t.parentKeywords as Prisma.InputJsonValue) ?? {},
        classifications: (t.classifications as Prisma.InputJsonValue) ?? {},
      },
    });
  }

  for (const r of arr<Record<string, unknown>>(data.bankClassificationRules)) {
    await tx.bankClassificationRule.create({
      data: {
        id: nid(),
        tenantId,
        companyId: newCompanyId,
        keyword: String(r.keyword),
        matchType: String(r.matchType ?? 'contains'),
        categoryName: String(r.categoryName),
        transactionSide: String(r.transactionSide ?? 'any'),
        transactionType: (r.transactionType as string | null) ?? null,
        isActive: r.isActive !== false,
        priority: Number(r.priority ?? 0),
      },
    });
  }

  for (const tpl of arr<Record<string, unknown>>(data.bankStatementTemplates)) {
    await tx.bankStatementTemplate.create({
      data: {
        id: nid(),
        tenantId,
        companyId: newCompanyId,
        bankName: String(tpl.bankName),
        customerName: (tpl.customerName as string | null) ?? null,
        headerRow: Number(tpl.headerRow),
        dataStartRow: Number(tpl.dataStartRow),
        dataEndRow: Number(tpl.dataEndRow ?? -1),
        columnsJson: (tpl.columnsJson as Prisma.InputJsonValue) ?? {},
        dateFormat: (tpl.dateFormat as string | null) ?? null,
        sampleHeaders: (tpl.sampleHeaders as Prisma.InputJsonValue) ?? {},
        isActive: tpl.isActive !== false,
        usageCount: Number(tpl.usageCount ?? 0),
        lastUsedAt: tpl.lastUsedAt ? ddate(tpl.lastUsedAt) : null,
        createdAt: ddate(tpl.createdAt),
        updatedAt: ddate(tpl.updatedAt),
      },
    });
  }

  const bankStatementMap = new Map<string, string>();
  for (const b of arr<Record<string, unknown>>(data.bankStatements)) {
    const id = nid();
    bankStatementMap.set(String(b.id), id);
    await tx.bankStatement.create({
      data: {
        id,
        tenantId,
        companyId: newCompanyId,
        fileName: String(b.fileName),
        fileFormat: String(b.fileFormat),
        companyName: String(b.companyName),
        bankName: String(b.bankName),
        startDate: (b.startDate as string | null) ?? null,
        endDate: (b.endDate as string | null) ?? null,
        status: String(b.status ?? 'mapping'),
        headerRow: Number(b.headerRow ?? 0),
        dataStartRow: Number(b.dataStartRow ?? 0),
        dataEndRow: Number(b.dataEndRow ?? 0),
        columnMapping: b.columnMapping != null ? (b.columnMapping as Prisma.InputJsonValue) : undefined,
        totalDeposits: dec(b.totalDeposits ?? 0),
        totalWithdrawals: dec(b.totalWithdrawals ?? 0),
        transactionCount: Number(b.transactionCount ?? 0),
        rawData: b.rawData != null ? (b.rawData as Prisma.InputJsonValue) : undefined,
        summaryJson: b.summaryJson != null ? (b.summaryJson as Prisma.InputJsonValue) : undefined,
        aiAnalysis: (b.aiAnalysis as string | null) ?? null,
        createdAt: ddate(b.createdAt),
        updatedAt: ddate(b.updatedAt),
      },
    });
  }

  for (const tr of arr<Record<string, unknown>>(data.bankStatementTransactions)) {
    const sid = bankStatementMap.get(String(tr.statementId));
    if (!sid) continue;
    const catId = tr.categoryId ? bscatMap.get(String(tr.categoryId)) : undefined;
    await tx.bankStatementTransaction.create({
      data: {
        id: nid(),
        statementId: sid,
        txDate: String(tr.txDate),
        description: String(tr.description ?? ''),
        categoryId: catId ?? null,
        debit: dec(tr.debit ?? 0),
        credit: dec(tr.credit ?? 0),
        balance: tr.balance != null ? dec(tr.balance) : null,
        reference: (tr.reference as string | null) ?? null,
        note: (tr.note as string | null) ?? null,
        sortOrder: Number(tr.sortOrder ?? 0),
        matchKeyword: (tr.matchKeyword as string | null) ?? null,
        classificationName: (tr.classificationName as string | null) ?? null,
        transactionType: (tr.transactionType as string | null) ?? null,
        manuallyClassified: Boolean(tr.manuallyClassified),
      },
    });
  }

  return { dailySalesSummaryMap, orderCategoryMap, orderProductMap, orderMap, bscatMap, bankStatementMap };
}

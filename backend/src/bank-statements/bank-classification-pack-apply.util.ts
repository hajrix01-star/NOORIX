import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext } from '../common/tenant-context';
import { parseBankClassificationExportPack } from './bank-classification-pack.util';

/**
 * استيراد/دمج حزمة تصنيفات كشف بنك (فئات شجرية + قواعد) لشركة.
 */
export async function importBankClassificationPackInCompany(
  prisma: TenantPrismaService,
  companyId: string,
  pack: unknown,
  mode: 'merge' | 'replace',
): Promise<{
  success: true;
  treeCreated: number;
  treeSkipped: number;
  rulesCreated: number;
  rulesSkipped: number;
}> {
  const tenantId = TenantContext.getTenantId();
  const data = parseBankClassificationExportPack(pack);

  if (mode === 'replace') {
    await prisma.bankTreeCategory.deleteMany({ where: { companyId } });
    await prisma.bankClassificationRule.deleteMany({ where: { companyId } });
  }

  let treeCreated = 0;
  let treeSkipped = 0;
  const existingTreeNames = new Set(
    (await prisma.bankTreeCategory.findMany({ where: { companyId }, select: { name: true } })).map((x) =>
      x.name.trim().toLowerCase(),
    ),
  );

  for (const row of data.treeCategories) {
    const key = row.name.trim().toLowerCase();
    if (mode === 'merge' && existingTreeNames.has(key)) {
      treeSkipped += 1;
      continue;
    }
    existingTreeNames.add(key);
    await prisma.bankTreeCategory.create({
      data: {
        tenantId,
        companyId,
        name: row.name,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
        transactionSide: row.transactionSide,
        transactionType: row.transactionType,
        parentKeywords: row.parentKeywords as object,
        classifications: row.classifications as object,
      },
    });
    treeCreated += 1;
  }

  const existingRuleKeys = new Set<string>();
  if (mode === 'merge') {
    const rdb = await prisma.bankClassificationRule.findMany({ where: { companyId } });
    for (const r of rdb) {
      existingRuleKeys.add(
        `${r.keyword.toLowerCase()}|${r.categoryName.toLowerCase()}|${r.matchType}|${r.transactionSide}`,
      );
    }
  }

  let rulesCreated = 0;
  let rulesSkipped = 0;
  for (const row of data.classificationRules) {
    const rk = `${row.keyword.toLowerCase()}|${row.categoryName.toLowerCase()}|${row.matchType}|${row.transactionSide}`;
    if (mode === 'merge' && existingRuleKeys.has(rk)) {
      rulesSkipped += 1;
      continue;
    }
    existingRuleKeys.add(rk);
    await prisma.bankClassificationRule.create({
      data: {
        tenantId,
        companyId,
        keyword: row.keyword,
        matchType: row.matchType,
        categoryName: row.categoryName,
        transactionSide: row.transactionSide,
        transactionType: row.transactionType,
        isActive: row.isActive,
        priority: row.priority,
      },
    });
    rulesCreated += 1;
  }

  return { success: true, treeCreated, treeSkipped, rulesCreated, rulesSkipped };
}

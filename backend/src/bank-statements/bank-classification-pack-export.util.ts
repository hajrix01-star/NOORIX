import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  CLASSIFICATION_PACK_VERSION,
  normalizeClassificationsJson,
  normalizeParentKeywordsJson,
  type BankClassificationExportPack,
} from './bank-classification-pack.util';

/**
 * تجميع حزمة تصدير فئات شجرية + قواعد لشركة (للتصدير أو نسخ بين شركات).
 */
export async function exportBankClassificationPackForCompany(
  prisma: TenantPrismaService,
  companyId: string,
): Promise<BankClassificationExportPack> {
  const trees = await prisma.bankTreeCategory.findMany({
    where: { companyId },
    orderBy: { sortOrder: 'asc' },
  });
  const rules = await prisma.bankClassificationRule.findMany({
    where: { companyId },
    orderBy: [{ priority: 'desc' }, { keyword: 'asc' }],
  });
  return {
    version: CLASSIFICATION_PACK_VERSION,
    exportedAt: new Date().toISOString(),
    treeCategories: trees.map((t) => ({
      name: t.name,
      sortOrder: t.sortOrder,
      isActive: t.isActive,
      transactionSide: t.transactionSide,
      transactionType: t.transactionType,
      parentKeywords: normalizeParentKeywordsJson(t.parentKeywords),
      classifications: normalizeClassificationsJson(t.classifications),
    })),
    classificationRules: rules.map((r) => ({
      keyword: r.keyword,
      matchType: r.matchType,
      categoryName: r.categoryName,
      transactionSide: r.transactionSide,
      transactionType: r.transactionType,
      isActive: r.isActive,
      priority: r.priority,
    })),
  };
}

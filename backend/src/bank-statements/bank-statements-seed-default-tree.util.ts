import { BadRequestException } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { DEFAULT_BANK_TREE_CATEGORY_SEEDS } from './default-bank-tree-categories.seed';

export async function seedDefaultBankTreeCategoriesIfEmpty(
  prisma: TenantPrismaService,
  companyId: string,
  tenantId: string,
): Promise<{ created: number }> {
  const n = await prisma.bankTreeCategory.count({ where: { companyId } });
  if (n > 0) {
    throw new BadRequestException(
      'توجد فئات تصنيف مسبقاً لهذه الشركة. احذفها أولاً أو عدّلها من الواجهة إذا أردت الاستيراد من جديد.',
    );
  }
  let created = 0;
  for (const row of DEFAULT_BANK_TREE_CATEGORY_SEEDS) {
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
    created += 1;
  }
  return { created };
}

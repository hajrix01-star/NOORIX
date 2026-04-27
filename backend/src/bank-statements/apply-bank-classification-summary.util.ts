import { Decimal } from '@prisma/client/runtime/library';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { classifyTransaction, type BankTreeCategoryRow, type BankRuleRow } from './bank-classification.engine';
import { buildSummaryJsonPayload, type TxLike } from './bank-statement-summary.builder';

async function findOrCreateStatementCategoryId(
  prisma: TenantPrismaService,
  companyId: string,
  nameAr: string,
): Promise<string> {
  const trimmed = nameAr.trim().slice(0, 200) || 'غير مصنف';
  const existing = await prisma.bankStatementCategory.findFirst({
    where: { companyId, nameAr: trimmed },
  });
  if (existing) return existing.id;
  const c = await prisma.bankStatementCategory.create({
    data: { companyId, nameAr: trimmed, nameEn: null, color: '#6366f1' },
  });
  return c.id;
}

/**
 * تصنيف تلقائي + ملخص JSON بعد استيراد/تأكيد كشف.
 */
export async function applyBankStatementClassificationAndSummary(
  prisma: TenantPrismaService,
  companyId: string,
  statementId: string,
): Promise<void> {
  const treeDb = await prisma.bankTreeCategory.findMany({
    where: { companyId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  const rulesDb = await prisma.bankClassificationRule.findMany({
    where: { companyId, isActive: true },
    orderBy: [{ priority: 'desc' }, { keyword: 'desc' }],
  });

  const treeRows: BankTreeCategoryRow[] = treeDb.map((t) => ({
    id: t.id,
    name: t.name,
    isActive: t.isActive,
    transactionSide: t.transactionSide,
    transactionType: t.transactionType,
    parentKeywords: t.parentKeywords,
    classifications: t.classifications,
  }));

  const ruleRows: BankRuleRow[] = rulesDb.map((r) => ({
    id: r.id,
    keyword: r.keyword,
    matchType: r.matchType,
    categoryName: r.categoryName,
    transactionSide: r.transactionSide,
    transactionType: r.transactionType,
    isActive: r.isActive,
    priority: r.priority,
  }));

  const txs = await prisma.bankStatementTransaction.findMany({
    where: { statementId },
    orderBy: { sortOrder: 'asc' },
  });

  for (const tx of txs) {
    if (tx.manuallyClassified) continue;
    const isCredit = new Decimal(tx.credit).gt(0);
    const r = classifyTransaction(tx.description, isCredit, treeRows, ruleRows);
    const catId = await findOrCreateStatementCategoryId(prisma, companyId, r.category);
    await prisma.bankStatementTransaction.update({
      where: { id: tx.id },
      data: {
        categoryId: catId,
        matchKeyword: r.matchedKeyword,
        classificationName: r.classificationName,
        transactionType: r.transactionType,
      },
    });
  }

  const txsForSummary = await prisma.bankStatementTransaction.findMany({
    where: { statementId },
    orderBy: { sortOrder: 'asc' },
    include: { category: true },
  });

  const txLikes: TxLike[] = txsForSummary.map((tx) => ({
    txDate: tx.txDate,
    description: tx.description,
    debit: new Decimal(tx.debit).toNumber(),
    credit: new Decimal(tx.credit).toNumber(),
    balance: tx.balance != null ? new Decimal(tx.balance).toNumber() : null,
    categoryLabel: tx.category?.nameAr || 'غير مصنف',
  }));

  const totalDeposits = txLikes.reduce((s, t) => s + t.credit, 0);
  const totalWithdrawals = txLikes.reduce((s, t) => s + t.debit, 0);
  const summaryPayload = buildSummaryJsonPayload(txLikes, totalDeposits, totalWithdrawals);

  await prisma.bankStatement.update({
    where: { id: statementId },
    data: {
      summaryJson: summaryPayload as object,
      aiAnalysis:
        treeRows.length || ruleRows.length
          ? `تصنيف تلقائي — ${treeRows.length} فئة شجرية، ${ruleRows.length} قاعدة`
          : `تصنيف تلقائي (قواعد مدمجة) — ${txsForSummary.length} حركة`,
    },
  });
}

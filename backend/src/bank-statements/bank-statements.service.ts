import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { GeminiService } from '../chat/gemini.service';
import { createBankStatementAfterUploadAndStructure } from './bank-statements-upload-analyze.util';
import { persistBankStatementConfirmMapping } from './bank-statements-confirm-mapping-persist.util';
import {
  buildBankStatementListWhere,
  formatBankStatementSummary,
} from './bank-statements-list-summary.util';
import { importBankClassificationPackInCompany } from './bank-classification-pack-apply.util';
import { exportBankClassificationPackForCompany } from './bank-classification-pack-export.util';
import { seedDefaultBankTreeCategoriesIfEmpty } from './bank-statements-seed-default-tree.util';
import { type ColumnMapping } from './bank-statements-header-heuristic.util';
import {
  type BankClassificationExportPack,
} from './bank-classification-pack.util';
import { assertBankClassificationSourceCompanyAccessible } from './bank-classification-import-access.util';
import { computeBankReconciliationStats } from './bank-reconciliation-stats.util';
import { applyBankStatementClassificationAndSummary } from './apply-bank-classification-summary.util';

export type { ColumnMapping };
export type {
  BankClassificationExportPack,
  BankClassificationPackRow,
  BankClassificationRulePackRow,
} from './bank-classification-pack.util';

@Injectable()
export class BankStatementsService {
  private readonly logger = new Logger(BankStatementsService.name);

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly geminiService: GeminiService,
  ) {}

  async uploadAndAnalyze(
    companyId: string,
    dto: { fileName: string; fileFormat: string; raw: string[][] },
  ) {
    const id = await createBankStatementAfterUploadAndStructure(
      { prisma: this.prisma, logger: this.logger, geminiService: this.geminiService },
      companyId,
      dto,
    );
    return this.findOne(companyId, id);
  }

  /** ترويسة الكشف عبر Gemini — مطابقة BankColumnMapper (Base44) */
  async suggestHeaderMetadata(raw: string[][]) {
    if (!raw?.length) throw new BadRequestException('raw مطلوب');
    const slice = raw.slice(0, 24);
    const r = await this.geminiService.suggestBankStatementHeaderMetadata(slice);
    return (
      r ?? {
        customerName: '',
        bankName: '',
        periodFrom: '',
        periodTo: '',
      }
    );
  }

  async confirmMapping(
    companyId: string,
    id: string,
    dto: {
      companyName: string;
      bankName: string;
      startDate?: string;
      endDate?: string;
      headerRow: number;
      dataStartRow: number;
      dataEndRow: number;
      columnMapping: ColumnMapping;
      raw: string[][];
    },
  ) {
    await persistBankStatementConfirmMapping(this.prisma, this.logger, companyId, id, dto);
    return this.findOne(companyId, id);
  }

  async list(companyId: string, filters?: { month?: string; bankName?: string }) {
    const where = buildBankStatementListWhere(companyId, filters);

    return this.prisma.bankStatement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        fileFormat: true,
        companyName: true,
        bankName: true,
        startDate: true,
        endDate: true,
        status: true,
        totalDeposits: true,
        totalWithdrawals: true,
        transactionCount: true,
        createdAt: true,
      },
    });
  }

  async findOne(companyId: string, id: string) {
    return this.prisma.bankStatement.findFirstOrThrow({
      where: { id, companyId },
      include: {
        transactions: {
          orderBy: { sortOrder: 'asc' },
          include: { category: true },
        },
      },
    });
  }

  async getSummary(companyId: string) {
    const agg = await this.prisma.bankStatement.aggregate({
      where: { companyId, status: 'completed' },
      _count: { id: true },
      _sum: {
        totalDeposits: true,
        totalWithdrawals: true,
      },
    });

    return formatBankStatementSummary(agg);
  }

  async updateTransactionCategory(companyId: string, statementId: string, txId: string, categoryId: string | null) {
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
    });
    if (!stmt) throw new BadRequestException('الكشف غير موجود');

    const row = await this.prisma.bankStatementTransaction.update({
      where: { id: txId },
      data: {
        categoryId,
        manuallyClassified: true,
        matchKeyword: null,
        classificationName: null,
      },
    });
    await applyBankStatementClassificationAndSummary(this.prisma, companyId, statementId);
    return row;
  }

  async updateTransactionNote(companyId: string, statementId: string, txId: string, note: string | null) {
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
    });
    if (!stmt) throw new BadRequestException('الكشف غير موجود');

    return this.prisma.bankStatementTransaction.update({
      where: { id: txId },
      data: { note },
    });
  }

  async delete(companyId: string, id: string) {
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id, companyId },
    });
    if (!stmt) throw new BadRequestException('الكشف غير موجود');
    await this.prisma.bankStatement.delete({ where: { id } });
    return { success: true };
  }

  async getCategories(companyId: string) {
    return this.prisma.bankStatementCategory.findMany({
      where: { companyId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCategory(companyId: string, dto: { nameAr: string; nameEn?: string; color?: string }) {
    return this.prisma.bankStatementCategory.create({
      data: {
        companyId,
        nameAr: dto.nameAr.trim(),
        nameEn: dto.nameEn?.trim() || null,
        color: dto.color || '#6366f1',
      },
    });
  }

  async deleteCategory(companyId: string, id: string) {
    await this.prisma.bankStatementCategory.deleteMany({
      where: { id, companyId },
    });
    return { success: true };
  }

  async reclassifyStatement(companyId: string, statementId: string) {
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id: statementId, companyId },
    });
    if (!stmt) throw new BadRequestException('الكشف غير موجود');
    await this.prisma.bankStatementTransaction.updateMany({
      where: { statementId, manuallyClassified: false },
      data: { categoryId: null, matchKeyword: null, classificationName: null, transactionType: null },
    });
    await applyBankStatementClassificationAndSummary(this.prisma, companyId, statementId);
    return this.findOne(companyId, statementId);
  }

  async getReconciliationStats(companyId: string, startDate: string, endDate: string) {
    return computeBankReconciliationStats(this.prisma, companyId, startDate, endDate);
  }

  async listTemplates(companyId: string) {
    return this.prisma.bankStatementTemplate.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { usageCount: 'desc' }],
    });
  }

  /** حذف نهائي — مطابق Base44 BankTemplate.delete */
  async deleteTemplate(companyId: string, templateId: string) {
    const n = await this.prisma.bankStatementTemplate.deleteMany({
      where: { id: templateId, companyId },
    });
    if (n.count === 0) throw new BadRequestException('القالب غير موجود');
    return { success: true };
  }

  /** تفعيل / تعطيل — مطابق تحديث is_active في Base44 */
  async setTemplateIsActive(companyId: string, templateId: string, isActive: boolean) {
    const n = await this.prisma.bankStatementTemplate.updateMany({
      where: { id: templateId, companyId },
      data: { isActive },
    });
    if (n.count === 0) throw new BadRequestException('القالب غير موجود');
    return { success: true };
  }

  async listTreeCategories(companyId: string) {
    return this.prisma.bankTreeCategory.findMany({
      where: { companyId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * استيراد قواعد التصنيف الافتراضية — فقط إذا كانت قائمة الفئات الشجرية فارغة.
   * (للشركات القديمة أو بعد حذف كل الفئات يدوياً)
   */
  async seedDefaultTreeCategoriesIfEmpty(companyId: string): Promise<{ created: number }> {
    const tenantId = TenantContext.getTenantId();
    return seedDefaultBankTreeCategoriesIfEmpty(this.prisma, companyId, tenantId);
  }

  async createTreeCategory(
    companyId: string,
    body: {
      name: string;
      sortOrder?: number;
      transactionSide?: string;
      transactionType?: string | null;
      parentKeywords: string[];
      classifications: { name: string; keywords: string[] }[];
    },
  ) {
    const tenantId = TenantContext.getTenantId();
    return this.prisma.bankTreeCategory.create({
      data: {
        tenantId,
        companyId,
        name: body.name.trim(),
        sortOrder: body.sortOrder ?? 100,
        transactionSide: body.transactionSide ?? 'any',
        transactionType: body.transactionType ?? null,
        parentKeywords: body.parentKeywords as object,
        classifications: body.classifications as object,
      },
    });
  }

  async updateTreeCategory(
    companyId: string,
    id: string,
    body: Partial<{
      name: string;
      sortOrder: number;
      isActive: boolean;
      transactionSide: string;
      transactionType: string | null;
      parentKeywords: string[];
      classifications: { name: string; keywords: string[] }[];
    }>,
  ) {
    const n = await this.prisma.bankTreeCategory.updateMany({
      where: { id, companyId },
      data: {
        ...(body.name != null ? { name: body.name.trim() } : {}),
        ...(body.sortOrder != null ? { sortOrder: body.sortOrder } : {}),
        ...(body.isActive != null ? { isActive: body.isActive } : {}),
        ...(body.transactionSide != null ? { transactionSide: body.transactionSide } : {}),
        ...(body.transactionType !== undefined ? { transactionType: body.transactionType } : {}),
        ...(body.parentKeywords != null ? { parentKeywords: body.parentKeywords as object } : {}),
        ...(body.classifications != null ? { classifications: body.classifications as object } : {}),
      },
    });
    if (n.count === 0) throw new BadRequestException('السجل غير موجود');
    return this.prisma.bankTreeCategory.findFirst({ where: { id, companyId } });
  }

  async deleteTreeCategory(companyId: string, id: string) {
    const n = await this.prisma.bankTreeCategory.deleteMany({ where: { id, companyId } });
    if (n.count === 0) throw new BadRequestException('السجل غير موجود');
    return { success: true };
  }

  async listClassificationRules(companyId: string) {
    return this.prisma.bankClassificationRule.findMany({
      where: { companyId },
      orderBy: [{ priority: 'desc' }, { keyword: 'asc' }],
    });
  }

  async createClassificationRule(
    companyId: string,
    body: {
      keyword: string;
      matchType?: string;
      categoryName: string;
      transactionSide?: string;
      transactionType?: string | null;
      priority?: number;
    },
  ) {
    const tenantId = TenantContext.getTenantId();
    return this.prisma.bankClassificationRule.create({
      data: {
        tenantId,
        companyId,
        keyword: body.keyword.trim(),
        matchType: body.matchType ?? 'contains',
        categoryName: body.categoryName.trim(),
        transactionSide: body.transactionSide ?? 'any',
        transactionType: body.transactionType ?? null,
        priority: body.priority ?? 0,
      },
    });
  }

  async deleteClassificationRule(companyId: string, id: string) {
    const n = await this.prisma.bankClassificationRule.deleteMany({ where: { id, companyId } });
    if (n.count === 0) throw new BadRequestException('السجل غير موجود');
    return { success: true };
  }

  async exportClassificationPack(companyId: string): Promise<BankClassificationExportPack> {
    return exportBankClassificationPackForCompany(this.prisma, companyId);
  }

  async importClassificationFromCompany(
    targetCompanyId: string,
    sourceCompanyId: string,
    mode: 'merge' | 'replace',
    user: { companyIds?: string[]; role?: string },
  ) {
    const tenantId = TenantContext.getTenantId();
    assertBankClassificationSourceCompanyAccessible(sourceCompanyId, targetCompanyId, user);

    const source = await this.prisma.company.findFirst({
      where: { id: sourceCompanyId },
      select: { id: true, tenantId: true },
    });
    const target = await this.prisma.company.findFirst({
      where: { id: targetCompanyId },
      select: { id: true, tenantId: true },
    });
    if (!source || !target || source.tenantId !== tenantId || target.tenantId !== tenantId) {
      throw new BadRequestException('الشركتان يجب أن تنتميان لنفس المستأجر.');
    }

    const pack = await this.exportClassificationPack(sourceCompanyId);
    return this.importClassificationPack(targetCompanyId, pack, mode);
  }

  async importClassificationPack(
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
    return importBankClassificationPackInCompany(this.prisma, companyId, pack, mode);
  }
}
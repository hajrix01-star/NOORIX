import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { GeminiService } from '../chat/gemini.service';
import { classifyTransaction, type BankTreeCategoryRow, type BankRuleRow } from './bank-classification.engine';
import { buildSummaryJsonPayload, type TxLike } from './bank-statement-summary.builder';
import {
  columnMappingToTemplateColumns,
  templateColumnsToMapping,
  type TemplateColumnsJson,
} from './bank-template-columns.util';
import {
  parseBankStatementRows,
  countTemplateValidRows,
  type BankRowMapping,
} from './bank-statement-row-parser';
import { DEFAULT_BANK_TREE_CATEGORY_SEEDS } from './default-bank-tree-categories.seed';

/** مطابقة كلمات مفتاحية للعناوين الشائعة في كشوف الحساب */
const HEADER_KEYWORDS: Record<string, string[]> = {
  date: ['تاريخ', 'date', 'التاريخ', 'trans date', 'value date', 'قيمة', 'يوم', 'day'],
  description: ['وصف', 'description', 'الوصف', 'بيان', 'تفاصيل', 'details', 'narration', 'مفهوم', 'البيان', 'تفاصيل الحركة'],
  notes: ['ملاحظات', 'ملاحظة', 'note', 'notes', 'remarks', 'comment'],
  debit: ['مدين', 'debit', 'سحب', 'خصم', 'withdraw', 'صادر', 'المدين', 'مدين'],
  credit: ['دائن', 'credit', 'ايداع', 'إيداع', 'deposit', 'وارد', 'الدائن', 'دائن'],
  balance: ['رصيد', 'balance', 'الرصيد', 'الباقي', 'الرصيد السابق', 'الرصيد اللاحق'],
  amount: ['مبلغ', 'amount', 'المبلغ', 'قيمة', 'value', 'المبلغ'],
  reference: ['مرجع', 'reference', 'ref', 'رقم العملية', 'txn'],
};

/** حد أمان لحجم JSON في قاعدة البيانات (صفوف كاملة للربط لاحقاً) */
const RAW_DATA_MAX_ROWS = 30_000;

export type ColumnMapping = {
  dateCol?: number;
  descCol?: number;
  notesCol?: number;
  mergeNotesWithDescription?: boolean;
  debitCol?: number;
  creditCol?: number;
  amountCol?: number; // عمود واحد: موجب=دائن، سالب=مدين
  balanceCol?: number;
  refCol?: number;
};

function toBankRowMapping(m: ColumnMapping): BankRowMapping | null {
  const dateCol = m.dateCol ?? -1;
  if (dateCol < 0) return null;
  return {
    dateCol,
    descCol: m.descCol,
    notesCol: m.notesCol,
    mergeNotesWithDescription: m.mergeNotesWithDescription,
    debitCol: m.debitCol,
    creditCol: m.creditCol,
    amountCol: m.amountCol,
    balanceCol: m.balanceCol,
    refCol: m.refCol,
  };
}

function matchHeaderType(cell: string): string | null {
  const s = String(cell ?? '').toLowerCase().trim();
  if (!s) return null;
  for (const [type, keywords] of Object.entries(HEADER_KEYWORDS)) {
    if (keywords.some((k) => s.includes(k.toLowerCase()))) return type;
  }
  return null;
}

/** بديل عند فشل Gemini: مسح الصفوف للعثور على صف العناوين */
function heuristicDetection(
  raw: string[][],
): { companyName: string; reportDate: string; headerRow: number; dataStartRow: number; dataEndRow: number; columnTypes: Record<number, string> } | null {
  if (!raw?.length || !Array.isArray(raw[0])) return null;
  const colCount = Math.max(...raw.map((r) => (Array.isArray(r) ? r.length : 0)), 1);
  const dataEndRow = Math.max(1, raw.length - 1);
  const maxScan = Math.min(15, raw.length - 1);

  for (let hr = 0; hr <= maxScan; hr++) {
    const headerCells = raw[hr] || [];
    const columnTypes: Record<number, string> = {};
    for (let i = 0; i < colCount; i++) {
      const t = matchHeaderType(headerCells[i]);
      columnTypes[i] = t || 'ignore';
    }
    const hasDate = Object.values(columnTypes).includes('date');
    const hasAmount =
      Object.values(columnTypes).some((t) => t === 'debit' || t === 'credit') ||
      Object.values(columnTypes).includes('amount');
    if (hasDate && hasAmount) {
      return {
        companyName: '',
        reportDate: '',
        headerRow: hr,
        dataStartRow: hr + 1,
        dataEndRow,
        columnTypes,
      };
    }
  }
  return null;
}

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
    const tenantId = TenantContext.getTenantId();
    if (!dto.raw?.length) throw new BadRequestException('الملف فارغ');

    const raw = dto.raw as string[][];
    const colCount = Math.max(...raw.map((r) => (Array.isArray(r) ? r.length : 0)), 1);
    const rawTruncated = raw.length > RAW_DATA_MAX_ROWS;
    const rawData = (rawTruncated ? raw.slice(0, RAW_DATA_MAX_ROWS) : raw) as unknown[][];
    if (rawTruncated) {
      this.logger.warn(`Bank upload: truncated raw from ${raw.length} to ${RAW_DATA_MAX_ROWS} rows`);
    }

    const stmt = await this.prisma.bankStatement.create({
      data: {
        tenantId,
        companyId,
        fileName: dto.fileName || 'كشف.xlsx',
        fileFormat: dto.fileFormat || 'excel',
        companyName: '',
        bankName: 'كشف الحساب',
        status: 'mapping',
        headerRow: 0,
        dataStartRow: 0,
        dataEndRow: Math.max(0, raw.length - 1),
        rawData: rawData as object,
      },
    });

    let skipAi = false;
    const rawForParse = rawData as unknown[][];
    const templates = await this.prisma.bankStatementTemplate.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ usageCount: 'desc' }, { updatedAt: 'desc' }],
    });
    for (const tpl of templates) {
      if (tpl.headerRow < 0 || tpl.headerRow >= rawForParse.length) continue;
      const currentHeaders = (rawForParse[tpl.headerRow] || [])
        .map((h) => String(h || '').toLowerCase().trim())
        .filter(Boolean);
      const saved = (Array.isArray(tpl.sampleHeaders) ? tpl.sampleHeaders : [])
        .map((h: unknown) => String(h || '').toLowerCase().trim())
        .filter(Boolean);
      if (currentHeaders.length === 0 || saved.length === 0) continue;
      const matchCount = saved.filter((h: string) => currentHeaders.includes(h)).length;
      const pct = matchCount / saved.length;
      if (pct < 0.85) continue;
      const colMap = templateColumnsToMapping((tpl.columnsJson || {}) as TemplateColumnsJson);
      const maxCol = Math.max(
        colMap.dateCol ?? -1,
        colMap.descCol ?? -1,
        colMap.notesCol ?? -1,
        colMap.debitCol ?? -1,
        colMap.creditCol ?? -1,
        colMap.balanceCol ?? -1,
        colMap.amountCol ?? -1,
        colMap.refCol ?? -1,
      );
      const sampleRow = rawForParse[tpl.dataStartRow];
      if (!sampleRow || sampleRow.length <= maxCol) continue;

      const dataEnd =
        tpl.dataEndRow === -1 ? Math.max(0, rawForParse.length - 1) : Math.min(tpl.dataEndRow, rawForParse.length - 1);
      const brm = toBankRowMapping(colMap as ColumnMapping);
      if (brm) {
        const parsed = parseBankStatementRows(rawForParse, brm, tpl.dataStartRow, dataEnd, null);
        const { valid, total } = countTemplateValidRows(parsed);
        const ratio = total > 0 ? valid / total : 0;
        if (total < 3 || ratio < 0.5) {
          this.logger.warn(
            `Bank template ${tpl.bankName} poor parse: ${valid}/${total} valid — deactivating (Base44 parity)`,
          );
          await this.prisma.bankStatementTemplate.update({
            where: { id: tpl.id },
            data: { isActive: false },
          });
          continue;
        }
      }

      await this.prisma.bankStatement.update({
        where: { id: stmt.id },
        data: {
          companyName: tpl.customerName || '',
          bankName: tpl.bankName || 'كشف الحساب',
          headerRow: tpl.headerRow,
          dataStartRow: tpl.dataStartRow,
          dataEndRow: dataEnd,
          columnMapping: colMap as object,
          aiAnalysis:
            (rawTruncated ? `تنبيه: الملف قُصّ إلى ${RAW_DATA_MAX_ROWS} صفاً. ` : '') +
            `قالب محفوظ: ${tpl.bankName} — تطابق عناوين ${Math.round(pct * 100)}%`,
        },
      });
      await this.prisma.bankStatementTemplate.update({
        where: { id: tpl.id },
        data: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
      });
      skipAi = true;
      this.logger.log(`Bank template matched: ${tpl.bankName} (${Math.round(pct * 100)}%)`);
      break;
    }

    let suggested: {
      companyName: string;
      reportDate: string;
      dataStartRow: number;
      dataEndRow: number;
      headerRow: number;
      columnTypes: Record<number, string>;
    } | null = null;

    if (!skipAi && this.geminiService.isAvailable()) {
      suggested = await this.geminiService.analyzeBankStatementStructure(rawForParse as string[][]);
    }
    if (!skipAi && !suggested) {
      suggested = heuristicDetection(rawForParse as string[][]);
      if (suggested) this.logger.log('Using heuristic fallback for column detection');
    }
    if (suggested) {
      const colMap: ColumnMapping = {};
      for (const [k, v] of Object.entries(suggested.columnTypes)) {
        const col = parseInt(k, 10);
        if (v === 'date') colMap.dateCol = col;
        else if (v === 'description') colMap.descCol = col;
        else if (v === 'notes') {
          colMap.notesCol = col;
          colMap.mergeNotesWithDescription = true;
        } else if (v === 'debit') colMap.debitCol = col;
        else if (v === 'credit') colMap.creditCol = col;
        else if (v === 'balance') colMap.balanceCol = col;
        else if (v === 'amount') colMap.amountCol = col;
        else if (v === 'reference') colMap.refCol = col;
      }
      await this.prisma.bankStatement.update({
        where: { id: stmt.id },
        data: {
          companyName: suggested.companyName || '',
          startDate: suggested.reportDate ? `${suggested.reportDate}-01` : null,
          endDate: suggested.reportDate ? `${suggested.reportDate}-28` : null,
          headerRow: suggested.headerRow,
          dataStartRow: suggested.dataStartRow,
          dataEndRow: suggested.dataEndRow,
          columnMapping: colMap as object,
          ...(rawTruncated
            ? {
                aiAnalysis: `تنبيه: الملف قُصّ إلى ${RAW_DATA_MAX_ROWS} صفاً للتخزين.`,
              }
            : {}),
        },
      });
    }

    return this.findOne(companyId, stmt.id);
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
    const stmt = await this.prisma.bankStatement.findFirst({
      where: { id, companyId },
      select: { id: true, rawData: true },
    });
    if (!stmt) throw new BadRequestException('الكشف غير موجود');

    const tenantId = TenantContext.getTenantId();
    const raw = dto.raw || (stmt.rawData as string[][]);
    if (!raw?.length) throw new BadRequestException('لا توجد بيانات');

    const map = dto.columnMapping;
    const dateCol = map.dateCol ?? -1;
    const debitCol = map.debitCol ?? -1;
    const creditCol = map.creditCol ?? -1;
    const amountCol = map.amountCol ?? -1;
    const balanceCol = map.balanceCol ?? -1;

    const hasAmounts = debitCol >= 0 || creditCol >= 0 || amountCol >= 0 || balanceCol >= 0;
    if (dateCol < 0 || !hasAmounts) {
      throw new BadRequestException(
        'يجب تحديد عمود التاريخ وعمود المدين أو الدائن أو المبلغ أو الرصيد',
      );
    }

    const start = Math.max(0, dto.dataStartRow);
    const end = Math.min(raw.length - 1, dto.dataEndRow);

    const brm = toBankRowMapping(map);
    if (!brm) throw new BadRequestException('تعيين عمود التاريخ غير صالح');

    const parsed = parseBankStatementRows(
      raw as unknown[][],
      brm,
      start,
      end,
      dto.startDate || null,
    );

    let totalDeposits = new Decimal(0);
    let totalWithdrawals = new Decimal(0);
    const transactions: Array<{
      txDate: string;
      description: string;
      debit: Decimal;
      credit: Decimal;
      balance: Decimal | null;
      reference: string | null;
      sortOrder: number;
      categoryId: string | null;
    }> = [];

    for (const p of parsed) {
      if (p.debit > 0) totalWithdrawals = totalWithdrawals.add(p.debit);
      if (p.credit > 0) totalDeposits = totalDeposits.add(p.credit);
      transactions.push({
        txDate: p.txDate,
        description: p.description,
        debit: new Decimal(p.debit),
        credit: new Decimal(p.credit),
        balance: p.balance != null ? new Decimal(p.balance) : null,
        reference: p.reference || null,
        sortOrder: p.sortOrder,
        categoryId: null,
      });
    }

    const rawToStore = (dto.raw?.length ? dto.raw : raw).slice(0, RAW_DATA_MAX_ROWS);

    await this.prisma.$transaction([
      this.prisma.bankStatementTransaction.deleteMany({ where: { statementId: id } }),
      this.prisma.bankStatement.update({
        where: { id },
        data: {
          companyName: dto.companyName || '',
          bankName: dto.bankName || 'كشف الحساب',
          startDate: dto.startDate || null,
          endDate: dto.endDate || null,
          headerRow: dto.headerRow,
          dataStartRow: dto.dataStartRow,
          dataEndRow: dto.dataEndRow,
          columnMapping: dto.columnMapping as object,
          rawData: rawToStore as object,
          totalDeposits,
          totalWithdrawals,
          transactionCount: transactions.length,
          status: 'completed',
        },
      }),
    ]);

    if (transactions.length > 0) {
      await this.prisma.bankStatementTransaction.createMany({
        data: transactions.map((t) => ({
          statementId: id,
          txDate: t.txDate,
          description: t.description,
          debit: t.debit,
          credit: t.credit,
          balance: t.balance,
          reference: t.reference,
          sortOrder: t.sortOrder,
          categoryId: t.categoryId,
        })),
      });
    }

    await this.saveTemplateAfterConfirm(tenantId, companyId, id, dto, raw);
    await this.applyClassificationAndSummary(companyId, id);

    return this.findOne(companyId, id);
  }

  async list(companyId: string, filters?: { month?: string; bankName?: string }) {
    const where: Record<string, unknown> = { companyId };
    if (filters?.month) {
      where.OR = [
        { startDate: { startsWith: filters.month } },
        { endDate: { startsWith: filters.month } },
      ];
    }
    if (filters?.bankName?.trim()) {
      where.bankName = { contains: filters.bankName.trim(), mode: 'insensitive' };
    }

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

    const deposits = agg._sum.totalDeposits ?? new Decimal(0);
    const withdrawals = agg._sum.totalWithdrawals ?? new Decimal(0);
    const net = deposits.sub(withdrawals);

    return {
      statementCount: agg._count.id,
      totalDeposits: deposits.toString(),
      totalWithdrawals: withdrawals.toString(),
      netFlow: net.toString(),
    };
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
    await this.applyClassificationAndSummary(companyId, statementId);
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
    await this.applyClassificationAndSummary(companyId, statementId);
    return this.findOne(companyId, statementId);
  }

  async getReconciliationStats(companyId: string, startDate: string, endDate: string) {
    const start = new Date(`${startDate.slice(0, 10)}T00:00:00.000Z`);
    const end = new Date(`${endDate.slice(0, 10)}T23:59:59.999Z`);

    const vaults = await this.prisma.vault.findMany({
      where: { companyId, isActive: true, isArchived: false },
    });
    const bankVaultIds = new Set(
      vaults
        .filter((v) => {
          const t = (v.type || '').toLowerCase();
          const n = `${v.nameAr} ${v.nameEn || ''}`.toLowerCase();
          const pm = (v.paymentMethod || '').toLowerCase();
          return (
            t === 'bank' ||
            t === 'app' ||
            n.includes('بنك') ||
            n.includes('bank') ||
            n.includes('مدى') ||
            n.includes('mada') ||
            n.includes('شبكة') ||
            pm.includes('مدى') ||
            pm.includes('mada') ||
            pm.includes('بنك')
          );
        })
        .map((v) => v.id),
    );

    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        kind: 'sale',
        status: 'active',
        transactionDate: { gte: start, lte: end },
      },
      select: { totalAmount: true, vaultId: true },
    });

    let totalBankSales = new Decimal(0);
    let saleCount = 0;
    for (const inv of invoices) {
      if (!inv.vaultId || !bankVaultIds.has(inv.vaultId)) continue;
      totalBankSales = totalBankSales.add(new Decimal(inv.totalAmount?.toString() ?? '0'));
      saleCount += 1;
    }

    // إيداعات نقدية/تحويلات إلى خزائن بنكية — مطابقة مفهوم deposit_to_bank في Base44 (LedgerEntry.transfer → vaultId = المستقبِل)
    const bankIds = [...bankVaultIds];
    let cashDeposits = new Decimal(0);
    if (bankIds.length > 0) {
      const transfers = await this.prisma.ledgerEntry.findMany({
        where: {
          companyId,
          status: 'active',
          referenceType: 'transfer',
          transactionDate: { gte: start, lte: end },
          vaultId: { in: bankIds },
        },
        select: { amount: true },
      });
      for (const e of transfers) {
        cashDeposits = cashDeposits.add(new Decimal(e.amount?.toString() ?? '0'));
      }
    }

    const expectedCredits = totalBankSales.add(cashDeposits);

    return {
      system_data: {
        sales_bank_total: totalBankSales.toNumber(),
        cash_deposits_total: cashDeposits.toNumber(),
        expected_credits: expectedCredits.toNumber(),
        sale_invoice_count: saleCount,
      },
    };
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
    const n = await this.prisma.bankTreeCategory.count({ where: { companyId } });
    if (n > 0) {
      throw new BadRequestException(
        'توجد فئات تصنيف مسبقاً لهذه الشركة. احذفها أولاً أو عدّلها من الواجهة إذا أردت الاستيراد من جديد.',
      );
    }
    let created = 0;
    for (const row of DEFAULT_BANK_TREE_CATEGORY_SEEDS) {
      await this.prisma.bankTreeCategory.create({
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
      created++;
    }
    return { created };
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

  // ── داخلي: قالب بعد التأكيد + تصنيف + ملخص (مطابقة تدفق Base44) ──

  private async saveTemplateAfterConfirm(
    tenantId: string,
    companyId: string,
    statementId: string,
    dto: {
      companyName: string;
      bankName: string;
      headerRow: number;
      dataStartRow: number;
      dataEndRow: number;
      columnMapping: ColumnMapping;
    },
    raw: string[][],
  ) {
    const headers = raw[dto.headerRow]?.map((h) => String(h || '').trim()).filter(Boolean) || [];
    if (headers.length < 2) return;
    const cols = columnMappingToTemplateColumns(dto.columnMapping);
    if (Object.keys(cols).length < 2) return;
    try {
      await this.prisma.bankStatementTemplate.create({
        data: {
          tenantId,
          companyId,
          bankName: (dto.bankName || 'غير محدد').slice(0, 200),
          customerName: (dto.companyName || '').slice(0, 200) || null,
          headerRow: dto.headerRow,
          dataStartRow: dto.dataStartRow,
          dataEndRow: dto.dataEndRow,
          columnsJson: cols as object,
          dateFormat: 'auto',
          sampleHeaders: headers.slice(0, 24) as object,
          isActive: true,
          usageCount: 1,
          lastUsedAt: new Date(),
        },
      });
    } catch (e) {
      this.logger.warn(`saveTemplateAfterConfirm: ${(e as Error).message}`);
    }
  }

  private async findOrCreateStatementCategory(companyId: string, nameAr: string): Promise<string> {
    const trimmed = nameAr.trim().slice(0, 200) || 'غير مصنف';
    const existing = await this.prisma.bankStatementCategory.findFirst({
      where: { companyId, nameAr: trimmed },
    });
    if (existing) return existing.id;
    const c = await this.prisma.bankStatementCategory.create({
      data: { companyId, nameAr: trimmed, nameEn: null, color: '#6366f1' },
    });
    return c.id;
  }

  private async applyClassificationAndSummary(companyId: string, statementId: string) {
    const treeDb = await this.prisma.bankTreeCategory.findMany({
      where: { companyId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    const rulesDb = await this.prisma.bankClassificationRule.findMany({
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

    let txs = await this.prisma.bankStatementTransaction.findMany({
      where: { statementId },
      orderBy: { sortOrder: 'asc' },
    });

    for (const tx of txs) {
      if (tx.manuallyClassified) continue;
      const isCredit = new Decimal(tx.credit).gt(0);
      const r = classifyTransaction(tx.description, isCredit, treeRows, ruleRows);
      const catId = await this.findOrCreateStatementCategory(companyId, r.category);
      await this.prisma.bankStatementTransaction.update({
        where: { id: tx.id },
        data: {
          categoryId: catId,
          matchKeyword: r.matchedKeyword,
          classificationName: r.classificationName,
          transactionType: r.transactionType,
        },
      });
    }

    const txsForSummary = await this.prisma.bankStatementTransaction.findMany({
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

    await this.prisma.bankStatement.update({
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
}

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { TenantContext } from '../common/tenant-context';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { GeminiService } from '../chat/gemini.service';

/** مطابقة كلمات مفتاحية للعناوين الشائعة في كشوف الحساب */
const HEADER_KEYWORDS: Record<string, string[]> = {
  date: ['تاريخ', 'date', 'التاريخ', 'trans date', 'value date', 'قيمة'],
  description: ['وصف', 'description', 'الوصف', 'بيان', 'تفاصيل', 'details', 'narration', 'مفهوم'],
  debit: ['مدين', 'debit', 'سحب', 'خصم', 'withdraw', 'صادر'],
  credit: ['دائن', 'credit', 'ايداع', 'إيداع', 'deposit', 'وارد', 'مبلغ'],
  balance: ['رصيد', 'balance', 'الرصيد', 'الباقي'],
  amount: ['مبلغ', 'amount', 'المبلغ', 'قيمة', 'value'],
};

const AR_NUMS = '٠١٢٣٤٥٦٧٨٩';
function toWesternNum(str: string): string {
  if (str == null) return '';
  return String(str).replace(/[٠-٩]/g, (c) => AR_NUMS.indexOf(c).toString());
}

function parseDate(val: unknown): string | null {
  if (val == null || val === '') return null;
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  const str = toWesternNum(String(val).trim());
  const dmy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const dmy2 = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy2) return `${dmy2[3]}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`;
  const ymd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseNumber(val: unknown): number | null {
  if (val == null || val === '') return null;
  const s = toWesternNum(String(val).replace(/,/g, '').replace(/\s/g, '').trim());
  const n = Number(s);
  return isNaN(n) ? null : n;
}

type ColumnMapping = {
  dateCol?: number;
  descCol?: number;
  debitCol?: number;
  creditCol?: number;
  amountCol?: number; // عمود واحد: موجب=دائن، سالب=مدين
  balanceCol?: number;
  refCol?: number;
};

function matchHeaderType(cell: string): string | null {
  const s = String(cell ?? '').toLowerCase().trim();
  if (!s) return null;
  for (const [type, keywords] of Object.entries(HEADER_KEYWORDS)) {
    if (keywords.some((k) => s.includes(k.toLowerCase()))) return type;
  }
  return null;
}

/** بديل عند فشل Gemini: اكتشاف بسيط بناءً على نصوص العناوين */
function heuristicDetection(
  raw: string[][],
): { headerRow: number; dataStartRow: number; dataEndRow: number; columnTypes: Record<number, string> } | null {
  if (!raw?.length || !Array.isArray(raw[0])) return null;
  const colCount = Math.max(...raw.map((r) => (Array.isArray(r) ? r.length : 0)), 1);
  const headerRow = 0;
  const dataStartRow = 1;
  const dataEndRow = Math.max(1, raw.length - 1);
  const headerCells = raw[headerRow] || [];
  const columnTypes: Record<number, string> = {};
  for (let i = 0; i < colCount; i++) {
    const t = matchHeaderType(headerCells[i]);
    if (t) columnTypes[i] = t;
    else columnTypes[i] = 'ignore';
  }
  const hasDate = Object.values(columnTypes).includes('date');
  const hasAmount =
    Object.values(columnTypes).some((t) => t === 'debit' || t === 'credit') ||
    Object.values(columnTypes).includes('amount');
  if (!hasDate || !hasAmount) return null;
  return { headerRow, dataStartRow, dataEndRow, columnTypes };
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
    const previewRows = Math.min(20, raw.length);
    const rawData = raw.slice(0, previewRows);

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

    let suggested: {
      companyName: string;
      reportDate: string;
      dataStartRow: number;
      dataEndRow: number;
      headerRow: number;
      columnTypes: Record<number, string>;
    } | null = null;

    if (this.geminiService.isAvailable()) {
      suggested = await this.geminiService.analyzeBankStatementStructure(raw);
    }
    if (!suggested) {
      suggested = heuristicDetection(raw);
      if (suggested) this.logger.log('Using heuristic fallback for column detection');
    }
    if (suggested) {
      const colMap: ColumnMapping = {};
      for (const [k, v] of Object.entries(suggested.columnTypes)) {
        const col = parseInt(k, 10);
        if (v === 'date') colMap.dateCol = col;
        else if (v === 'description') colMap.descCol = col;
        else if (v === 'debit') colMap.debitCol = col;
        else if (v === 'credit') colMap.creditCol = col;
        else if (v === 'balance') colMap.balanceCol = col;
        else if (v === 'amount') colMap.amountCol = col;
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
        },
      });
    }

    return this.findOne(companyId, stmt.id);
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

    const raw = dto.raw || (stmt.rawData as string[][]);
    if (!raw?.length) throw new BadRequestException('لا توجد بيانات');

    const map = dto.columnMapping;
    const dateCol = map.dateCol ?? -1;
    const descCol = map.descCol ?? -1;
    const debitCol = map.debitCol ?? -1;
    const creditCol = map.creditCol ?? -1;
    const amountCol = map.amountCol ?? -1;
    const balanceCol = map.balanceCol ?? -1;

    const hasAmounts = debitCol >= 0 || creditCol >= 0 || amountCol >= 0;
    if (dateCol < 0 || !hasAmounts)
      throw new BadRequestException('يجب تحديد عمود التاريخ وعمود المدين أو الدائن أو المبلغ');

    const start = Math.max(0, dto.dataStartRow);
    const end = Math.min(raw.length - 1, dto.dataEndRow);

    let totalDeposits = new Decimal(0);
    let totalWithdrawals = new Decimal(0);
    const transactions: Array<{
      txDate: string;
      description: string;
      debit: Decimal;
      credit: Decimal;
      balance: Decimal | null;
      sortOrder: number;
      categoryId: string | null;
    }> = [];

    for (let i = start; i <= end; i++) {
      const row = raw[i] || [];
      const dateVal = row[dateCol];
      const date = parseDate(dateVal);
      const desc = descCol >= 0 ? String(row[descCol] ?? '').trim() : '';
      let debitVal = debitCol >= 0 ? parseNumber(row[debitCol]) : null;
      let creditVal = creditCol >= 0 ? parseNumber(row[creditCol]) : null;
      const amountVal = amountCol >= 0 ? parseNumber(row[amountCol]) : null;
      const balanceVal = balanceCol >= 0 ? parseNumber(row[balanceCol]) : null;

      if (amountCol >= 0 && amountVal != null && amountVal !== 0) {
        if (amountVal > 0) creditVal = amountVal;
        else debitVal = Math.abs(amountVal);
      }

      let debit = new Decimal(0);
      let credit = new Decimal(0);
      if (debitVal != null && debitVal > 0) {
        debit = new Decimal(debitVal);
        totalWithdrawals = totalWithdrawals.add(debitVal);
      }
      if (creditVal != null && creditVal > 0) {
        credit = new Decimal(creditVal);
        totalDeposits = totalDeposits.add(creditVal);
      }

      if (date && (debit.toNumber() > 0 || credit.toNumber() > 0)) {
        transactions.push({
          txDate: date,
          description: desc,
          debit,
          credit,
          balance: balanceVal != null ? new Decimal(balanceVal) : null,
          sortOrder: i - start,
          categoryId: null,
        });
      }
    }

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
          sortOrder: t.sortOrder,
          categoryId: t.categoryId,
        })),
      });
    }

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

    return this.prisma.bankStatementTransaction.update({
      where: { id: txId },
      data: { categoryId },
    });
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
}

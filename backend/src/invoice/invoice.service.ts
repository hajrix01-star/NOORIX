/**
 * InvoiceService — طبقة رفيعة (Thin Layer) فوق FinancialCoreService
 *
 * لا يحتوي على منطق مالي مباشر — يُفوَّض بالكامل للمحرك المركزي.
 * المسؤوليات المتبقية هنا:
 *   - findAll, findOne (قراءة فقط)
 *   - update (AuditLog + مزامنة تاريخ القيود عبر FinancialCoreService)
 *   - createWithLedger يُفوَّض → FinancialCoreService.processOutflow
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { FinancialCoreService } from '../financial-core/financial-core.service';
import { VaultsService } from '../vaults/vaults.service';
import { toYmd } from '../common/utils/to-ymd.util';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateInvoiceBatchDto } from './dto/create-invoice-batch.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { resolveFixedExpenseCoverageForCreate } from './invoice-fixed-expense-coverage.util';
import { toPublicInvoiceView } from './invoice-to-public.util';
import { buildInvoiceListQueryParts } from './invoice-list-query-parts.util';
import type { InvoiceListQueryContract } from './invoice-list-query-contract.util';
import type { PurchaseBatchSummariesQueryContract } from './purchase-batch-summaries-query-contract.util';
import {
  rollupKindAggForInvoiceList,
  computeOutflowSummaryFromSumsByKind,
  emptyInvoiceListAggregates,
} from './invoice-kind-rollup.util';
import { loadInvoiceListInflowByVault } from './invoice-list-inflow-by-vault.util';
import { loadInvoiceDayCloseReport } from './invoice-day-close-report.util';
import { loadPurchaseBatchSummaries } from './invoice-purchase-batch-summaries.util';
import { filterValidInvoiceBatchLineItems } from './invoice-batch-valid-items.util';
import { buildOutflowDtosForInvoiceBatch } from './invoice-batch-build-dtos.util';
import {
  assertCreateInvoiceSupplierInvoiceNumberIfRequired,
  computeCreateInvoiceOutflowNetAndTax,
} from './invoice-create-outflow-prep.util';
import {
  downloadInvoiceAttachment,
  removeInvoiceAttachment,
  saveInvoiceAttachment,
} from './invoice-attachment-ops.util';
import { updateInvoiceInTransaction } from './invoice-update-in-transaction.util';
import {
  resolveInvoiceCancelReferenceId,
  resolveInvoiceCancelReferenceType,
} from './invoice-cancel-reference.util';

type InvoiceKindAggRow = {
  kind: string;
  _sum: { netAmount: Prisma.Decimal | null; taxAmount: Prisma.Decimal | null; totalAmount: Prisma.Decimal | null };
  _count: { _all: number };
};

@Injectable()
export class InvoiceService {
  /** كاش 60 ثانية لـ count + groupBy بنفس فلاتر القائمة (باستثناء رقم الصفحة) لتخفيف الاستعلامات الثقيلة. */
  private readonly invoiceListAggCache = new Map<
    string,
    { exp: number; total: number; kindAggRows: InvoiceKindAggRow[] }
  >();

  constructor(
    private readonly prisma:         TenantPrismaService,
    private readonly audit:          AuditLogService,
    private readonly financialCore:  FinancialCoreService,
    private readonly vaultsService:  VaultsService,
  ) {}

  private async loadCompanyVatRatePercent(companyId: string): Promise<number | null> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { vatRatePercent: true },
    });
    return company?.vatRatePercent != null ? Number(company.vatRatePercent) : null;
  }

  private clearInvoiceListAggCacheForCompany(companyId: string): void {
    const prefix = `v1|${companyId}|`;
    for (const key of this.invoiceListAggCache.keys()) {
      if (key.startsWith(prefix)) this.invoiceListAggCache.delete(key);
    }
  }

  /**
   * إنشاء فاتورة — يُفوَّض بالكامل للمحرك المالي المركزي.
   * حساب الضريبة: الصافي والضريبة يُحسبان دائماً من totalAmount و isTaxable ونسبة الشركة.
   */
  async createWithLedger(dto: CreateInvoiceDto, userId?: string | null) {
    assertCreateInvoiceSupplierInvoiceNumberIfRequired(dto);

    let expenseCoverageYear: number | undefined;
    let expenseCoverageQuarter: number | undefined;
    let expenseCoverageMonthStart: number | undefined;
    let expenseMonthsCovered: number | undefined;

    if (dto.kind === 'fixed_expense' && dto.expenseLineId) {
      const cov = resolveFixedExpenseCoverageForCreate(dto);
      expenseCoverageYear = cov.expenseCoverageYear;
      expenseCoverageQuarter = cov.expenseCoverageQuarter;
      expenseCoverageMonthStart = cov.expenseCoverageMonthStart;
      expenseMonthsCovered = cov.expenseMonthsCovered;
    }

    const vatRatePercent = await this.loadCompanyVatRatePercent(dto.companyId);
    const { net, tax } = computeCreateInvoiceOutflowNetAndTax(dto, vatRatePercent);
    const vaultSplits =
      dto.vaultSplits?.length ?
        dto.vaultSplits.map((s) => ({ vaultId: s.vaultId, amount: String(s.amount) }))
      : undefined;

    const raw = await this.financialCore.processOutflow(
      {
        companyId:       dto.companyId,
        supplierId:      dto.supplierId ?? undefined,
        employeeId:      dto.employeeId ?? undefined,
        expenseLineId:   dto.expenseLineId ?? undefined,
        categoryId:      dto.categoryId ?? undefined,
        supplierInvoiceNumber: dto.supplierInvoiceNumber ?? undefined,
        kind:            dto.kind,
        totalAmount:     String(dto.totalAmount),
        netAmount:       net,
        taxAmount:       tax,
        transactionDate: toYmd(
          typeof dto.transactionDate === 'string' ? dto.transactionDate : new Date(dto.transactionDate),
        ),
        invoiceDate:     dto.invoiceDate ? String(dto.invoiceDate) : undefined,
        vaultId:         vaultSplits ? undefined : (dto.vaultId ?? undefined),
        vaultSplits,
        batchId:            dto.batchId  ?? undefined,
        debitAccountId:     dto.debitAccountId ?? undefined,
        idempotencyKey:     dto.idempotencyKey ?? undefined,
        notes:              dto.notes ?? undefined,
        installmentCount:   dto.installmentCount ?? undefined,
        installmentAmount:  dto.installmentAmount != null ? String(dto.installmentAmount) : undefined,
        expenseCoverageYear:       expenseCoverageYear,
        expenseCoverageQuarter:    expenseCoverageQuarter ?? null,
        expenseCoverageMonthStart: expenseCoverageMonthStart,
        expenseMonthsCovered:      expenseMonthsCovered,
        warrantyFollowUp:
          ['purchase', 'expense', 'fixed_expense'].includes(dto.kind) &&
          dto.warrantyFollowUp === true,
      },
      userId ?? undefined,
    );
    this.clearInvoiceListAggCacheForCompany(dto.companyId);
    return {
      ...raw,
      invoice: toPublicInvoiceView(raw.invoice),
    };
  }

  /**
   * إنشاء دفعة فواتير في transaction واحدة — Rollback الكل عند فشل أي فاتورة.
   */
  async createBatchWithLedger(dto: CreateInvoiceBatchDto, userId?: string | null) {
    try {
      const batchId = `B-${Date.now()}`;
      const batchNotesPart = dto.batchNotes?.trim() || '';
      const validItems = filterValidInvoiceBatchLineItems(dto.items, batchNotesPart);
      if (validItems.length === 0) {
        throw new BadRequestException('لا توجد صفوف صالحة للحفظ.');
      }
      const txDate = toYmd(
        typeof dto.transactionDate === 'string' ? dto.transactionDate : new Date(dto.transactionDate),
      );

      const vatRatePercent = await this.loadCompanyVatRatePercent(dto.companyId);
      const dtos = await buildOutflowDtosForInvoiceBatch(
        this.prisma,
        dto.companyId,
        validItems,
        txDate,
        batchId,
        dto.vaultId ?? undefined,
        batchNotesPart,
        vatRatePercent,
      );
      const results = await this.financialCore.processOutflowBatch(
        dtos,
        userId ?? undefined,
        dto.idempotencyKey,
      );
      this.clearInvoiceListAggCacheForCompany(dto.companyId);
      return {
        batchId,
        count:   results.length,
        invoices: results.map((r) => toPublicInvoiceView(r.invoice)),
      };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
      throw new BadRequestException(
        err instanceof Error ? err.message : 'فشل حفظ الدفعة. تأكد من وجود خزنة وحسابات مصروفات للشركة.',
      );
    }
  }

  /**
   * تعديل فاتورة مع تسجيل القيمة القديمة والجديدة في AuditLog.
   * عند status: 'cancelled' → يُستدعى cancelOperation لإلغاء الفاتورة والقيود معاً
   *    (لا تُحتسب الفاتورة الملغاة في الميزانية ولا التقارير).
   */
  async update(id: string, dto: UpdateInvoiceDto, companyId: string, userId?: string | null) {
    if (dto.status === 'cancelled') {
      const inv = await this.prisma.invoice.findFirstOrThrow({ where: { id, companyId } });
      const refType = resolveInvoiceCancelReferenceType(inv.kind);
      const referenceId = resolveInvoiceCancelReferenceId(inv.kind, id, inv.dailySalesSummaryId);
      await this.financialCore.cancelOperation(
        { companyId, referenceType: refType, referenceId, reason: 'إلغاء من واجهة الفواتير' },
        userId ?? undefined,
      );
      this.clearInvoiceListAggCacheForCompany(companyId);
      const cancelled = await this.prisma.invoice.findFirstOrThrow({ where: { id, companyId } });
      return toPublicInvoiceView(cancelled);
    }

    const updated = await updateInvoiceInTransaction(
      this.prisma,
      this.financialCore,
      id,
      dto,
      companyId,
      userId,
    );
    this.clearInvoiceListAggCacheForCompany(companyId);
    return toPublicInvoiceView(updated);
  }

  async findOne(id: string, companyId: string) {
    const inv = await this.prisma.invoice.findFirstOrThrow({
      where:   { id, companyId },
      include: {
        supplier: true,
        vault:    true,
        vaultAllocations: { include: { vault: { select: { id: true, nameAr: true, nameEn: true, type: true } } } },
      },
    });
    return toPublicInvoiceView(inv);
  }

  /**
   * مستخدمو النظام الذين لهم فواتير في الشركة — لقائمة فلتر «منشئ السجل».
   */
  async getCreatorFilterOptions(companyId: string) {
    if (!companyId?.trim()) return { users: [] };
    const distinct = await this.prisma.invoice.findMany({
      where: { companyId, createdByUserId: { not: null } },
      select: { createdByUserId: true },
      distinct: ['createdByUserId'],
    });
    const ids = distinct.map((d) => d.createdByUserId).filter((x): x is string => !!x);
    if (ids.length === 0) return { users: [] };
    const users = await this.prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, nameAr: true, nameEn: true, email: true },
    });
    users.sort((a, b) => {
      const la = (a.nameAr || a.nameEn || a.email || '').localeCompare(b.nameAr || b.nameEn || b.email || '', 'ar');
      return la;
    });
    return { users };
  }

  async findAll(query: InvoiceListQueryContract, includeExecSummary = true) {
    const { companyId } = query;
    const { where, orderBy, size, p, aggKey, activeWhere } = buildInvoiceListQueryParts(query);
    const aggTtlMs = 60_000;
    const aggNow = Date.now();
    const hitAgg = this.invoiceListAggCache.get(aggKey);
    const itemsPromise = this.prisma.invoice.findMany({
      where,
      orderBy,
      skip: (p - 1) * size,
      take: size,
      include: {
        supplier: true,
        employee: { select: { id: true, name: true, nameEn: true } },
        createdByUser: { select: { id: true, nameAr: true, nameEn: true, email: true } },
        expenseLine: { select: { id: true, nameAr: true, kind: true } },
        vault: { select: { id: true, nameAr: true, nameEn: true, type: true } },
        vaultAllocations: {
          include: { vault: { select: { id: true, nameAr: true, nameEn: true, type: true } } },
        },
      },
    });
    let items: Awaited<typeof itemsPromise>;
    let total: number;
    if (!includeExecSummary) {
      const [loadedItems, counted] = await Promise.all([
        itemsPromise,
        hitAgg && hitAgg.exp > aggNow ? Promise.resolve(hitAgg.total) : this.prisma.invoice.count({ where }),
      ]);
      items = loadedItems;
      total = counted;
      return {
        items: items.map((row) => toPublicInvoiceView(row)),
        total,
        page: p,
        pageSize: size,
        ...emptyInvoiceListAggregates(),
      };
    }

    let kindAggRows: InvoiceKindAggRow[];
    if (hitAgg && hitAgg.exp > aggNow) {
      items = await itemsPromise;
      total = hitAgg.total;
      kindAggRows = hitAgg.kindAggRows;
    } else {
      const [loadedItems, counted, grouped] = await Promise.all([
        itemsPromise,
        this.prisma.invoice.count({ where }),
        this.prisma.invoice.groupBy({
          by: ['kind'],
          where: activeWhere,
          _sum: { netAmount: true, taxAmount: true, totalAmount: true },
          _count: { _all: true },
        }),
      ]);
      items = loadedItems;
      total = counted;
      kindAggRows = grouped;
      this.invoiceListAggCache.set(aggKey, { exp: aggNow + aggTtlMs, total, kindAggRows });
    }
    const { sums, sumsByKind } = rollupKindAggForInvoiceList(kindAggRows);
    const outflowSummary = computeOutflowSummaryFromSumsByKind(sumsByKind);
    const inflowByVault = await loadInvoiceListInflowByVault(this.prisma, companyId, activeWhere);
    return {
      items: items.map((row) => toPublicInvoiceView(row)),
      total,
      page: p,
      pageSize: size,
      sums,
      sumsByKind,
      inflowByVault,
      outflowSummary,
    };
  }

  async getDayCloseReport(companyId: string, dateStr: string) {
    return loadInvoiceDayCloseReport(this.prisma, this.vaultsService, companyId, dateStr);
  }

  async findPurchaseBatchSummaries(query: PurchaseBatchSummariesQueryContract) {
    return loadPurchaseBatchSummaries(this.prisma, query);
  }

  async saveAttachment(
    invoiceId: string,
    companyId: string,
    file: Express.Multer.File | undefined,
    userId?: string | null,
  ) {
    return saveInvoiceAttachment(this.prisma, this.audit, invoiceId, companyId, file, userId);
  }

  async removeAttachment(invoiceId: string, companyId: string, userId?: string | null) {
    return removeInvoiceAttachment(this.prisma, this.audit, invoiceId, companyId, userId);
  }

  async downloadAttachment(invoiceId: string, companyId: string, res: Response): Promise<void> {
    return downloadInvoiceAttachment(this.prisma, invoiceId, companyId, res);
  }
}

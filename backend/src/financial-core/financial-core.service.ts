/**
 * FinancialCoreService — المحرك المالي الموحد (Single Entry Point)
 *
 * ═══════════════════════════════════════════════════════════════
 * القاعدة الذهبية: كل عملية مالية = فاتورة + قيد + تحديث + تدقيق
 *                  في transaction واحدة لا تتجزأ.
 * ═══════════════════════════════════════════════════════════════
 *
 * العمليات المدعومة:
 *   processOutflow  → مشتريات | مصاريف | HR | إيجارات | مصاريف ثابتة
 *   processInflow   → مبيعات يومية (ملخص يومي بقنوات متعددة)
 *   processTransfer → تحويل بين خزائن
 *   cancelOperation → إلغاء عملية (لا حذف — Status: cancelled)
 *
 * الأمان:
 *   - userId: مأخوذ من TenantContext تلقائياً — ممنوع null
 *   - RLS: كل query يمر عبر TenantPrismaService.withTenant()
 *   - Rollback: فشل أي خطوة داخل $transaction يُلغي الكل
 */
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantContext }        from '../common/tenant-context';
import { nowSaudi }             from '../common/utils/date-utils';
import { splitTax }             from '../common/utils/math-engine';
import { generateInvoiceSerial } from '../common/utils/invoice-serial';
import { FiscalPeriodService }  from '../fiscal-period/fiscal-period.service';
import { IdempotencyService }   from '../idempotency/idempotency.service';
import type {
  OutflowDto,
  InflowDto,
  SalesChannelDto,
  TransferDto,
  CancelOperationDto,
} from './dto/financial-operation.dto';

// Prisma-safe snapshot type
type JsonObject = Prisma.InputJsonValue;

// alias داخلي للـ Prisma transaction client
type TxClient = Parameters<Parameters<TenantPrismaService['$transaction']>[0]>[0];

const RETRY_MAX = 3;
const RETRY_BASE_MS = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Exponential backoff + jitter: 100–150ms, 200–250ms, 400–450ms — يقلل thundering herd */
function getRetryDelayMs(attempt: number): number {
  const baseDelay = Math.pow(2, attempt) * RETRY_BASE_MS;
  const jitter = Math.floor(Math.random() * 50);
  return baseDelay + jitter;
}

/**
 * التحقق من توازن القيد المزدوج: مجموع المدين = مجموع الدائن
 * يستخدم Decimal.js لدقة الهللة — لا float math.
 *
 * @param debitEntries  — قائمة المبالغ المدينة
 * @param creditEntries — قائمة المبالغ الدائنة
 * @throws BadRequestException إذا لم يتساو المجموعان
 */
function validateJournalBalance(
  debitEntries:  Array<{ amount: Prisma.Decimal | number | string }>,
  creditEntries: Array<{ amount: Prisma.Decimal | number | string }>,
): void {
  const sum = (arr: Array<{ amount: Prisma.Decimal | number | string }>) =>
    arr.reduce(
      (s, e) => s.plus(new Prisma.Decimal(String(e.amount))),
      new Prisma.Decimal(0),
    );

  const debitTotal  = sum(debitEntries);
  const creditTotal = sum(creditEntries);

  if (!debitTotal.isFinite() || !creditTotal.isFinite()) {
    throw new BadRequestException(
      `Journal entry contains non-finite amount: debit=${debitTotal}, credit=${creditTotal}`,
    );
  }
  if (!debitTotal.equals(creditTotal)) {
    throw new BadRequestException(
      `Unbalanced journal entry: debit (${debitTotal.toFixed(4)}) ≠ credit (${creditTotal.toFixed(4)})`,
    );
  }
}

@Injectable()
export class FinancialCoreService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly fiscalPeriod: FiscalPeriodService,
    private readonly idempotency: IdempotencyService,
  ) {}

  // ══════════════════════════════════════════════════════════
  // 1. OUTFLOW — صرف: مشتريات / مصاريف / HR / مصاريف ثابتة
  // ══════════════════════════════════════════════════════════
  /**
   * processOutflow: ينشئ داخل transaction واحدة:
   *   [1] Invoice (الفاتورة المالية)
   *   [2] LedgerEntry (القيد المزدوج: مدين=مصروف، دائن=خزنة)
   *   [3] AuditLog (بصمة المستخدم + القيمة)
   *
   * @param dto - بيانات عملية الصرف
   * @param callerUserId - userId من الـ Controller (fallback للـ AsyncLocalStorage)
   */
  async processOutflow(dto: OutflowDto, callerUserId?: string) {
    const tenantId = this._resolveTenantId();
    if (dto.idempotencyKey) {
      const keyHash = this.idempotency.hashKey('processOutflow', {
        companyId:             dto.companyId,
        kind:                  dto.kind,
        totalAmount:           dto.totalAmount,
        transactionDate:       dto.transactionDate,
        supplierId:            dto.supplierId,
        supplierInvoiceNumber: dto.supplierInvoiceNumber,
        vaultId:               dto.vaultId,
        employeeId:            dto.employeeId,
        idempotencyKey:        dto.idempotencyKey,
      });
      const cached = await this.idempotency.getCachedResult(tenantId, dto.companyId, keyHash);
      if (cached) return cached as Awaited<ReturnType<typeof this._processOutflowInner>>;
      const result = await this._withRetry(async () => this._processOutflowInner(dto, callerUserId));
      await this.idempotency.storeResult(tenantId, dto.companyId, keyHash, result);
      return result;
    }
    return this._withRetry(async () => this._processOutflowInner(dto, callerUserId));
  }

  private async _processOutflowInner(dto: OutflowDto, callerUserId?: string) {
    const userId   = this._resolveUserId(callerUserId);
    const tenantId = this._resolveTenantId();
    const { entryDate, txDate } = this._buildDates(dto.transactionDate);

    return this.db.withTenant(async (tx) => {
      // السيريال يُولَّد دائماً من النظام — لا يُقبل من العميل
      const invoiceNumber = dto.invoiceNumber || await generateInvoiceSerial(tx, dto.companyId, dto.kind, txDate);
      await this.fiscalPeriod.assertPeriodOpenForDate(tx, dto.companyId, txDate);

      // ── [A] Resolve Accounts ─────────────────────────────
      const creditAccountId = await this._getVaultAccount(tx, dto.companyId, dto.vaultId);
      const debitAccountId  = dto.debitAccountId
        ?? await this._getDefaultExpenseAccount(tx, dto.companyId, dto.kind);

      // ── [B] Create Invoice ───────────────────────────────
      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          companyId:       dto.companyId,
          supplierId:      dto.supplierId ?? null,
          employeeId:      dto.employeeId ?? null,
          expenseLineId:   dto.expenseLineId ?? null,
          categoryId:      dto.categoryId ?? null,
          invoiceNumber:         invoiceNumber,
          supplierInvoiceNumber: dto.supplierInvoiceNumber ?? null,
          kind:                  dto.kind,
          totalAmount:           new Prisma.Decimal(dto.totalAmount),
          netAmount:             new Prisma.Decimal(dto.netAmount),
          taxAmount:             new Prisma.Decimal(dto.taxAmount),
          transactionDate:       txDate,
          invoiceDate:           dto.invoiceDate ? new Date(dto.invoiceDate) : null,
          entryDate,
          vaultId:               dto.vaultId || null,
          batchId:               dto.batchId ?? null,
          notes:                 dto.notes ?? null,
          status:                'active',
        },
      });

      // ── [C] Create LedgerEntry (القيد المزدوج) ──────────
      // Outflow: debit = حساب المصروف | credit = حساب الخزنة (كلاهما نفس المبلغ)
      validateJournalBalance(
        [{ amount: dto.totalAmount }],   // debit:  expense / asset
        [{ amount: dto.totalAmount }],   // credit: vault
      );
      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          tenantId,
          companyId:       dto.companyId,
          debitAccountId,
          creditAccountId,
          amount:          new Prisma.Decimal(dto.totalAmount),
          transactionDate: txDate,
          entryDate,
          referenceType:   dto.kind === 'salary' ? 'salary' : dto.kind === 'advance' ? 'advance' : 'invoice',
          referenceId:     invoice.id,
          vaultId:         dto.vaultId || null,
          employeeId:      dto.employeeId ?? null,
          createdById:     userId,
          status:          'active',
        },
      });

      // ── [D] Create AuditLog (بصمة المستخدم) ─────────────
      await tx.auditLog.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          userId,
          action:    'create',
          entity:    'invoice',
          entityId:  invoice.id,
          newValue:  this._invoiceSnapshot(invoice) as JsonObject,
          createdAt: entryDate,
        },
      });

      return { invoice, ledgerEntry };
    });
  }

  /**
   * processOutflowBatch: إنشاء دفعة فواتير في transaction واحدة.
   * فشل أي فاتورة → Rollback الكل.
   * batchIdempotencyKey — مفتاح عدم التكرار على مستوى الدفعة كاملة
   */
  async processOutflowBatch(dtos: OutflowDto[], callerUserId?: string, batchIdempotencyKey?: string) {
    const tenantId = this._resolveTenantId();
    if (batchIdempotencyKey && dtos.length > 0) {
      const keyHash = this.idempotency.hashKey('processOutflowBatch', {
        companyId:             dtos[0].companyId,
        batchId:               dtos[0].batchId,
        transactionDate:       dtos[0].transactionDate,
        itemCount:             dtos.length,
        totalAmounts:          dtos.map((d) => d.totalAmount).join(','),
        idempotencyKey:        batchIdempotencyKey,
      });
      const cached = await this.idempotency.getCachedResult(tenantId, dtos[0].companyId, keyHash);
      if (cached) return cached as Awaited<ReturnType<typeof this._processBatchInner>>;
      const result = await this._processBatchInner(dtos, callerUserId, tenantId);
      await this.idempotency.storeResult(tenantId, dtos[0].companyId, keyHash, result);
      return result;
    }
    return this._processBatchInner(dtos, callerUserId, tenantId);
  }

  private async _processBatchInner(dtos: OutflowDto[], callerUserId: string | undefined, tenantId: string) {
    const userId = this._resolveUserId(callerUserId);
    return this.db.withTenant(async (tx) => {
      const results = [];
      for (const dto of dtos) {
        const { entryDate, txDate } = this._buildDates(dto.transactionDate);
        const serial = dto.invoiceNumber || await generateInvoiceSerial(tx, dto.companyId, dto.kind, txDate);
        await this.fiscalPeriod.assertPeriodOpenForDate(tx, dto.companyId, txDate);
        const creditAccountId = await this._getVaultAccount(tx, dto.companyId, dto.vaultId);
        const debitAccountId  = dto.debitAccountId
          ?? await this._getDefaultExpenseAccount(tx, dto.companyId, dto.kind);

        // صمام التوازن لكل عنصر في الدفعة
        validateJournalBalance(
          [{ amount: dto.totalAmount }],
          [{ amount: dto.totalAmount }],
        );

        const invoice = await tx.invoice.create({
          data: {
            tenantId,
            companyId:       dto.companyId,
            supplierId:      dto.supplierId ?? null,
            employeeId:      dto.employeeId ?? null,
            expenseLineId:   dto.expenseLineId ?? null,
            categoryId:      dto.categoryId ?? null,
            invoiceNumber:         serial,
            supplierInvoiceNumber: dto.supplierInvoiceNumber ?? null,
            kind:                  dto.kind,
            totalAmount:           new Prisma.Decimal(dto.totalAmount),
            netAmount:             new Prisma.Decimal(dto.netAmount),
            taxAmount:             new Prisma.Decimal(dto.taxAmount),
            transactionDate: txDate,
            invoiceDate:     dto.invoiceDate ? new Date(dto.invoiceDate) : null,
            entryDate,
            vaultId:         dto.vaultId || null,
            batchId:         dto.batchId ?? null,
            notes:           dto.notes ?? null,
            status:          'active',
          },
        });

        await tx.ledgerEntry.create({
          data: {
            tenantId,
            companyId:       dto.companyId,
            debitAccountId,
            creditAccountId,
            amount:          new Prisma.Decimal(dto.totalAmount),
            transactionDate: txDate,
            entryDate,
            referenceType:   dto.kind === 'salary' ? 'salary' : dto.kind === 'advance' ? 'advance' : 'invoice',
            referenceId:     invoice.id,
            vaultId:         dto.vaultId || null,
            employeeId:      dto.employeeId ?? null,
            createdById:     userId,
            status:          'active',
          },
        });

        await tx.auditLog.create({
          data: {
            tenantId,
            companyId: dto.companyId,
            userId,
            action:    'create',
            entity:    'invoice',
            entityId:  invoice.id,
            newValue:  this._invoiceSnapshot(invoice) as JsonObject,
            createdAt: entryDate,
          },
        });

        results.push({ invoice, ledgerEntry: null });
      }
      return results;
    });
  }

  // ══════════════════════════════════════════════════════════
  // 2. INFLOW — دخل: المبيعات اليومية (ملخص بقنوات متعددة)
  // ══════════════════════════════════════════════════════════
  /**
   * processInflow: ينشئ داخل transaction واحدة:
   *   [1] DailySalesSummary + DailySalesChannels
   *   [2] LedgerEntry لكل قناة بيع (مدين=خزنة، دائن=إيراد)
   *   [3] AuditLog
   */
  async processInflow(dto: InflowDto, callerUserId?: string) {
    const tenantId = this._resolveTenantId();
    if (dto.idempotencyKey) {
      const keyHash = this.idempotency.hashKey('processInflow', {
        companyId: dto.companyId,
        transactionDate: dto.transactionDate,
        channels: dto.channels,
        idempotencyKey: dto.idempotencyKey,
      });
      const cached = await this.idempotency.getCachedResult(tenantId, dto.companyId, keyHash);
      if (cached) return cached as Awaited<ReturnType<typeof this._processInflowInner>>;
    }

    const result = await this._withRetry(async () => this._processInflowInner(dto, callerUserId));

    if (dto.idempotencyKey) {
      const keyHash = this.idempotency.hashKey('processInflow', {
        companyId: dto.companyId,
        transactionDate: dto.transactionDate,
        channels: dto.channels,
        idempotencyKey: dto.idempotencyKey,
      });
      await this.idempotency.storeResult(tenantId, dto.companyId, keyHash, result);
    }
    return result;
  }

  private async _processInflowInner(dto: InflowDto, callerUserId?: string) {
    const userId   = this._resolveUserId(callerUserId);
    const tenantId = this._resolveTenantId();
    const { entryDate, txDate } = this._buildDates(dto.transactionDate);

    if (!dto.channels?.length) {
      throw new BadRequestException('يجب إدخال قناة بيع واحدة على الأقل.');
    }

    const totalAmount = dto.channels.reduce(
      (sum: Prisma.Decimal, ch: { vaultId: string; amount: string }) => sum.plus(new Prisma.Decimal(ch.amount || '0')),
      new Prisma.Decimal(0),
    );
    if (totalAmount.lte(0)) {
      throw new BadRequestException('يجب أن يكون إجمالي المبيعات أكبر من صفر.');
    }

    return this.db.withTenant(async (tx) => {
      await this.fiscalPeriod.assertPeriodOpenForDate(tx, dto.companyId, txDate);

      // ── [A] توليد رقم ملخص فريد DS-YYYYMMDD-NNN ────────
      const dateStr  = dto.transactionDate.replace(/-/g, '').slice(0, 8);
      const existing = await tx.dailySalesSummary.count({
        where: { companyId: dto.companyId, summaryNumber: { startsWith: `DS-${dateStr}` } },
      });
      const summaryNumber = `DS-${dateStr}-${String(existing + 1).padStart(3, '0')}`;

      // ── [A2] جلب إعدادات الضريبة للشركة ─────────────────
      const company = await tx.company.findUnique({
        where: { id: dto.companyId },
        select: { vatEnabledForSales: true, vatRatePercent: true },
      });
      const vatEnabled = !!company?.vatEnabledForSales;
      const vatRateDecimal = company?.vatRatePercent != null
        ? Number(company.vatRatePercent) / 100
        : 0.15;

      // ── [B] حساب الإيراد الافتراضي وحساب الضريبة ─────────
      const revenueAccountId = await this._getDefaultRevenueAccount(tx, dto.companyId);
      const vatAccountId = vatEnabled ? await this._getVatCollectedAccount(tx, dto.companyId) : null;

      // ── [C] الحصول على accountId لكل خزنة قناة بيع ────────
      const activeChannels = dto.channels.filter(
        (ch: { vaultId: string; amount: string }) => new Prisma.Decimal(ch.amount || '0').gt(0),
      );

      const vaultAccounts = await Promise.all(
        activeChannels.map((ch: { vaultId: string; amount: string }) => this._getVaultAccount(tx, dto.companyId, ch.vaultId)),
      );

      // ── [D] حساب الصافي والضريبة (إذا مفعّلة) ─────────────
      let totalNet = new Prisma.Decimal(0);
      let totalTax = new Prisma.Decimal(0);
      const channelNetTax: { net: Prisma.Decimal; tax: Prisma.Decimal }[] = [];
      for (const ch of activeChannels) {
        const amt = new Prisma.Decimal(ch.amount || '0');
        if (vatEnabled) {
          const { net, tax } = splitTax(amt.toString(), vatRateDecimal);
          channelNetTax.push({ net: new Prisma.Decimal(net.toString()), tax: new Prisma.Decimal(tax.toString()) });
          totalNet = totalNet.plus(net);
          totalTax = totalTax.plus(tax);
        } else {
          channelNetTax.push({ net: amt, tax: new Prisma.Decimal(0) });
          totalNet = totalNet.plus(amt);
        }
      }

      // ── [E] Create DailySalesSummary + Channels ──────────
      const summary = await tx.dailySalesSummary.create({
        data: {
          tenantId,
          companyId:       dto.companyId,
          summaryNumber,
          transactionDate: txDate,
          customerCount:   dto.customerCount || 0,
          cashOnHand:      new Prisma.Decimal(dto.cashOnHand || '0'),
          totalAmount,
          notes:           dto.notes ?? null,
          status:          'active',
          createdById:     userId,
          entryDate,
          channels: {
            create: activeChannels.map((ch: { vaultId: string; amount: string }) => ({
              vaultId: ch.vaultId,
              amount:  new Prisma.Decimal(ch.amount),
            })),
          },
        },
      });

      // ── [E2] Create Invoice (kind=sale) مع الصافي والضريبة ──
      await tx.invoice.create({
        data: {
          tenantId,
          companyId:           dto.companyId,
          invoiceNumber:       summaryNumber,
          kind:                'sale',
          totalAmount,
          netAmount:           vatEnabled ? totalNet : totalAmount,
          taxAmount:           vatEnabled ? totalTax : new Prisma.Decimal(0),
          transactionDate:     txDate,
          entryDate,
          vaultId:             activeChannels[0]?.vaultId ?? null,
          notes:               dto.notes ?? null,
          dailySalesSummaryId: summary.id,
          status:              'active',
        },
      });

      // ── [F] LedgerEntry لكل قناة: إيراد + ضريبة (إن وُجدت) ──
      // debit: قيمة قناة البيع كاملة (تدخل الخزنة)
      // credit: صافي الإيراد + ضريبة القيمة المضافة (إن وُجدت)
      validateJournalBalance(
        activeChannels.map((ch) => ({ amount: ch.amount })),              // debit: vault channels
        channelNetTax.flatMap(({ net, tax }) =>
          vatEnabled && tax.gt(0) ? [{ amount: net }, { amount: tax }] : [{ amount: net }],
        ),                                                                 // credit: revenue + VAT
      );

      const ledgerEntries = [];
      for (let idx = 0; idx < activeChannels.length; idx++) {
        const ch = activeChannels[idx];
        const { net, tax } = channelNetTax[idx];
        const vaultAcc = vaultAccounts[idx];

        // قيد الإيراد: مدين خزنة، دائن إيراد
        const entryRevenue = await tx.ledgerEntry.create({
            data: {
              tenantId,
              companyId:       dto.companyId,
              debitAccountId:  vaultAcc,
              creditAccountId: revenueAccountId,
              amount:          net,
              transactionDate: txDate,
              entryDate,
              referenceType:   'sale',
              referenceId:     summary.id,
              vaultId:         ch.vaultId,
              createdById:     userId,
              status:          'active',
            },
          });
        ledgerEntries.push(entryRevenue);
        // قيد الضريبة: مدين خزنة، دائن ضريبة محصلة
        if (vatEnabled && tax.gt(0) && vatAccountId) {
          const entryVat = await tx.ledgerEntry.create({
              data: {
                tenantId,
                companyId:       dto.companyId,
                debitAccountId:  vaultAcc,
                creditAccountId: vatAccountId,
                amount:          tax,
                transactionDate: txDate,
                entryDate,
                referenceType:   'sale',
                referenceId:     summary.id,
                vaultId:         ch.vaultId,
                createdById:     userId,
                status:          'active',
              },
            });
          ledgerEntries.push(entryVat);
        }
      }

      // ── [F] AuditLog ─────────────────────────────────────
      await tx.auditLog.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          userId,
          action:    'create',
          entity:    'daily_sales_summary',
          entityId:  summary.id,
          newValue:  {
            summaryNumber,
            totalAmount:   totalAmount.toString(),
            customerCount: dto.customerCount,
            channelCount:  activeChannels.length,
          } as JsonObject,
          createdAt: entryDate,
        },
      });

      return { summary, ledgerEntries };
    });
  }

  /**
   * updateInflow: تحديث ملخص مبيعات — يلغي القيود القديمة وينشئ قيوداً جديدة.
   */
  async updateInflow(
    summaryId: string,
    companyId: string,
    dto: {
      transactionDate: string;
      customerCount: number;
      cashOnHand: string;
      channels: { vaultId: string; amount: string }[];
      notes?: string;
    },
    callerUserId?: string,
  ) {
    const userId   = this._resolveUserId(callerUserId);
    const tenantId = this._resolveTenantId();
    const { entryDate, txDate } = this._buildDates(dto.transactionDate);

    const totalAmount = dto.channels.reduce(
      (sum: Prisma.Decimal, ch: SalesChannelDto) => sum.plus(new Prisma.Decimal(ch.amount || '0')),
      new Prisma.Decimal(0),
    );
    if (totalAmount.lte(0)) {
      throw new BadRequestException('يجب أن يكون إجمالي المبيعات أكبر من صفر.');
    }

    const activeChannels = dto.channels.filter(
      (ch: SalesChannelDto) => new Prisma.Decimal(ch.amount || '0').gt(0),
    );
    if (!activeChannels.length) {
      throw new BadRequestException('يجب إدخال قناة بيع واحدة على الأقل.');
    }

    return this.db.withTenant(async (tx) => {
      await this.fiscalPeriod.assertPeriodOpenForDate(tx, companyId, txDate);

      const summary = await tx.dailySalesSummary.findFirst({
        where: { id: summaryId, companyId, status: 'active' },
      });
      if (!summary) {
        throw new NotFoundException('الملخص غير موجود أو تم إلغاؤه.');
      }

      // ── [A] إلغاء القيود القديمة ─────────────────────────
      await tx.ledgerEntry.updateMany({
        where: {
          companyId:     companyId,
          referenceType: 'sale',
          referenceId:   summaryId,
          status:       'active',
        },
        data: { status: 'cancelled' },
      });

      // ── [B] حذف القنوات القديمة وإنشاء جديدة ─────────────
      await tx.dailySalesChannel.deleteMany({ where: { summaryId } });
      await tx.dailySalesChannel.createMany({
        data: activeChannels.map((ch: SalesChannelDto) => ({
          summaryId,
          vaultId: ch.vaultId,
          amount:  new Prisma.Decimal(ch.amount),
        })),
      });

      // ── [C] تحديث الملخص ─────────────────────────────────
      await tx.dailySalesSummary.update({
        where: { id: summaryId },
        data:  {
          transactionDate: txDate,
          customerCount:   dto.customerCount,
          cashOnHand:      new Prisma.Decimal(dto.cashOnHand || '0'),
          totalAmount,
          notes:           dto.notes ?? null,
        },
      });

      // ── [C2] جلب إعدادات الضريبة وحساب الصافي والضريبة ─────
      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { vatEnabledForSales: true, vatRatePercent: true },
      });
      const vatEnabled = !!company?.vatEnabledForSales;
      const vatRateDecimal = company?.vatRatePercent != null ? Number(company.vatRatePercent) / 100 : 0.15;

      let totalNet = new Prisma.Decimal(0);
      let totalTax = new Prisma.Decimal(0);
      const channelNetTax: { net: Prisma.Decimal; tax: Prisma.Decimal }[] = [];
      for (const ch of activeChannels) {
        const amt = new Prisma.Decimal(ch.amount || '0');
        if (vatEnabled) {
          const { net, tax } = splitTax(amt.toString(), vatRateDecimal);
          channelNetTax.push({ net: new Prisma.Decimal(net.toString()), tax: new Prisma.Decimal(tax.toString()) });
          totalNet = totalNet.plus(net);
          totalTax = totalTax.plus(tax);
        } else {
          channelNetTax.push({ net: amt, tax: new Prisma.Decimal(0) });
          totalNet = totalNet.plus(amt);
        }
      }

      // ── [C3] تحديث فاتورة المبيعات المرتبطة ───────────────
      const saleInvoice = await tx.invoice.findFirst({
        where: { dailySalesSummaryId: summaryId, companyId },
      });
      if (saleInvoice) {
        await tx.invoice.update({
          where: { id: saleInvoice.id },
          data:  {
            transactionDate: txDate,
            totalAmount,
            netAmount: vatEnabled ? totalNet : totalAmount,
            taxAmount: vatEnabled ? totalTax : new Prisma.Decimal(0),
          },
        });
      }

      // ── [D] إنشاء قيود جديدة (إيراد + ضريبة إن وُجدت) ─────
      const revenueAccountId = await this._getDefaultRevenueAccount(tx, companyId);
      const vatAccountId = vatEnabled ? await this._getVatCollectedAccount(tx, companyId) : null;
      const vaultAccounts = await Promise.all(
        activeChannels.map((ch: SalesChannelDto) => this._getVaultAccount(tx, companyId, ch.vaultId)),
      );

      // debit: قيمة كل قناة كاملة | credit: صافي + ضريبة
      validateJournalBalance(
        activeChannels.map((ch) => ({ amount: ch.amount })),
        channelNetTax.flatMap(({ net, tax }) =>
          vatEnabled && tax.gt(0) ? [{ amount: net }, { amount: tax }] : [{ amount: net }],
        ),
      );

      for (let idx = 0; idx < activeChannels.length; idx++) {
        const ch = activeChannels[idx];
        const { net, tax } = channelNetTax[idx];
        const vaultAcc = vaultAccounts[idx];

        await tx.ledgerEntry.create({
          data: {
            tenantId,
            companyId:       companyId,
            debitAccountId:  vaultAcc,
            creditAccountId: revenueAccountId,
            amount:          net,
            transactionDate: txDate,
            entryDate,
            referenceType:   'sale',
            referenceId:     summaryId,
            vaultId:         ch.vaultId,
            createdById:     userId,
            status:          'active',
          },
        });
        if (vatEnabled && tax.gt(0) && vatAccountId) {
          await tx.ledgerEntry.create({
            data: {
              tenantId,
              companyId:       companyId,
              debitAccountId:  vaultAcc,
              creditAccountId: vatAccountId,
              amount:          tax,
              transactionDate: txDate,
              entryDate,
              referenceType:   'sale',
              referenceId:     summaryId,
              vaultId:         ch.vaultId,
              createdById:     userId,
              status:          'active',
            },
          });
        }
      }

      // ── [E] AuditLog ─────────────────────────────────────
      await tx.auditLog.create({
        data: {
          tenantId,
          companyId,
          userId,
          action:    'update',
          entity:    'daily_sales_summary',
          entityId:  summaryId,
          newValue:  {
            totalAmount:   totalAmount.toString(),
            customerCount: dto.customerCount,
            channelCount:  activeChannels.length,
          } as JsonObject,
          createdAt: entryDate,
        },
      });

      const updated = await tx.dailySalesSummary.findUnique({
        where: { id: summaryId },
        include: { channels: true },
      });
      return updated;
    });
  }

  // ══════════════════════════════════════════════════════════
  // 3. TRANSFER — تحويل بين خزائن
  // ══════════════════════════════════════════════════════════
  /**
   * processTransfer: ينشئ LedgerEntry واحداً:
   *   debit  = خزنة المستقبِل (رصيدها يزيد)
   *   credit = خزنة المُرسِل  (رصيدها يقل)
   */
  async processTransfer(dto: TransferDto, callerUserId?: string) {
    const tenantId = this._resolveTenantId();
    if (dto.idempotencyKey) {
      const keyHash = this.idempotency.hashKey('processTransfer', {
        companyId:       dto.companyId,
        fromVaultId:     dto.fromVaultId,
        toVaultId:       dto.toVaultId,
        amount:          dto.amount,
        transactionDate: dto.transactionDate,
        idempotencyKey:  dto.idempotencyKey,
      });
      const cached = await this.idempotency.getCachedResult(tenantId, dto.companyId, keyHash);
      if (cached) return cached as Awaited<ReturnType<typeof this._processTransferInner>>;
      const result = await this._withRetry(async () => this._processTransferInner(dto, callerUserId));
      await this.idempotency.storeResult(tenantId, dto.companyId, keyHash, result);
      return result;
    }
    return this._withRetry(async () => this._processTransferInner(dto, callerUserId));
  }

  private async _processTransferInner(dto: TransferDto, callerUserId?: string) {
    const userId   = this._resolveUserId(callerUserId);
    const tenantId = this._resolveTenantId();
    const { entryDate, txDate } = this._buildDates(dto.transactionDate);

    if (dto.fromVaultId === dto.toVaultId) {
      throw new BadRequestException('لا يمكن التحويل من خزنة لنفسها.');
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('مبلغ التحويل يجب أن يكون أكبر من صفر.');
    }

    return this.db.withTenant(async (tx) => {
      await this.fiscalPeriod.assertPeriodOpenForDate(tx, dto.companyId, txDate);

      const [fromAccountId, toAccountId] = await Promise.all([
        this._getVaultAccount(tx, dto.companyId, dto.fromVaultId),
        this._getVaultAccount(tx, dto.companyId, dto.toVaultId),
      ]);

      const referenceId = `TRF-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

      // Transfer: debit = toVault (يدخل) | credit = fromVault (يخرج)
      validateJournalBalance(
        [{ amount: dto.amount }],   // debit:  toVault
        [{ amount: dto.amount }],   // credit: fromVault
      );
      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          tenantId,
          companyId:       dto.companyId,
          debitAccountId:  toAccountId,     // المستقبِل: رصيده يزيد (مدين)
          creditAccountId: fromAccountId,   // المُرسِل: رصيده يقل (دائن)
          amount,
          transactionDate: txDate,
          entryDate,
          referenceType:   'transfer',
          referenceId,
          vaultId:         dto.toVaultId,
          createdById:     userId,
          status:          'active',
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          userId,
          action:    'create',
          entity:    'transfer',
          entityId:  ledgerEntry.id,
          newValue:  {
            referenceId,
            fromVaultId: dto.fromVaultId,
            toVaultId:   dto.toVaultId,
            amount:      dto.amount,
            notes:       dto.notes,
          },
          createdAt: entryDate,
        },
      });

      return { ledgerEntry, referenceId };
    });
  }

  // ══════════════════════════════════════════════════════════
  // 4. CANCEL — إلغاء عملية سابقة (لا حذف — Status: cancelled)
  // ══════════════════════════════════════════════════════════
  /**
   * cancelOperation: يُغيّر status → 'cancelled' لـ:
   *   - الفاتورة (إن كانت invoice)
   *   - ملخص المبيعات (إن كان sale)
   *   - جميع القيود المرتبطة (LedgerEntries)
   *   - يُسجّل في AuditLog
   *
   * ✅ لا حذف فعلي — سلامة البيانات المحاسبية محفوظة دائماً.
   */
  async cancelOperation(dto: CancelOperationDto, callerUserId?: string) {
    const userId   = this._resolveUserId(callerUserId);
    const tenantId = this._resolveTenantId();
    const entryDate = nowSaudi();

    return this.db.withTenant(async (tx) => {
      // ── [A] إلغاء الوثيقة الأصلية ────────────────────────
      let oldSnapshot: Record<string, unknown> = {};

      if (dto.referenceType === 'invoice' || dto.referenceType === 'salary' || dto.referenceType === 'advance') {
        const inv = await tx.invoice.findFirst({
          where: { id: dto.referenceId, companyId: dto.companyId },
        });
        if (!inv) throw new NotFoundException('الفاتورة غير موجودة أو لا تنتمي لهذه الشركة');
        if (inv.status === 'cancelled') {
          throw new BadRequestException('الفاتورة ملغاة مسبقاً');
        }
        oldSnapshot = this._invoiceSnapshot(inv);
        await tx.invoice.update({
          where: { id: dto.referenceId },
          data:  { status: 'cancelled' },
        });

      } else if (dto.referenceType === 'sale') {
        const summary = await tx.dailySalesSummary.findFirst({
          where: { id: dto.referenceId, companyId: dto.companyId },
          include: { saleInvoice: true },
        });
        if (!summary) throw new NotFoundException('الملخص غير موجود');
        if (summary.status === 'cancelled') {
          throw new BadRequestException('الملخص ملغى مسبقاً');
        }
        oldSnapshot = { id: summary.id, summaryNumber: summary.summaryNumber, totalAmount: String(summary.totalAmount) };
        await tx.dailySalesSummary.update({
          where: { id: dto.referenceId },
          data:  { status: 'cancelled' },
        });
        // إلغاء فاتورة المبيعات المرتبطة (للعرض الموحد في قسم الفواتير)
        if (summary.saleInvoice) {
          await tx.invoice.update({
            where: { id: summary.saleInvoice.id },
            data:  { status: 'cancelled' },
          });
        }
      }

      // ── [B] إلغاء جميع القيود المرتبطة ──────────────────
      const ledgerCount = await tx.ledgerEntry.updateMany({
        where: {
          companyId:     dto.companyId,
          referenceType: dto.referenceType,
          referenceId:   dto.referenceId,
          status:        'active',
        },
        data: { status: 'cancelled' },
      });

      // ── [C] AuditLog ─────────────────────────────────────
      await tx.auditLog.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          userId,
          action:    'cancel',
          entity:    dto.referenceType,
          entityId:  dto.referenceId,
          oldValue:  { ...oldSnapshot, status: 'active' }    as JsonObject,
          newValue:  { ...oldSnapshot, status: 'cancelled', reason: dto.reason, cancelledBy: userId } as JsonObject,
          createdAt: entryDate,
        },
      });

      return {
        cancelled:      true,
        referenceType:  dto.referenceType,
        referenceId:    dto.referenceId,
        ledgersCancelled: ledgerCount.count,
      };
    });
  }

  // ══════════════════════════════════════════════════════════
  // PRIVATE: Retry على تعارض المعاملات (Prisma P2034)
  // ══════════════════════════════════════════════════════════

  private async _withRetry<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < RETRY_MAX; i++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        const code = (e as { code?: string })?.code;
        if (code === 'P2034' && i < RETRY_MAX - 1) {
          await sleep(getRetryDelayMs(i));
          continue;
        }
        throw e;
      }
    }
    throw lastError;
  }

  // ══════════════════════════════════════════════════════════
  // PRIVATE: Account Resolution (مركزي — لا تكرار)
  // ══════════════════════════════════════════════════════════

  private async _getVaultAccount(tx: TxClient, companyId: string, vaultId?: string): Promise<string> {
    if (!vaultId) {
      // إذا لم تُحدَّد الخزنة، جلب أول خزنة نشطة للشركة كـ fallback
      const defaultVault = await tx.vault.findFirst({
        where:   { companyId, isActive: true, isArchived: false },
        select:  { accountId: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!defaultVault) {
        throw new BadRequestException(
          `لا توجد خزائن للشركة ${companyId}. يرجى إنشاء خزينة أولاً.`,
        );
      }
      return defaultVault.accountId;
    }

    const vault = await tx.vault.findFirst({
      where:  { id: vaultId, companyId },
      select: { accountId: true },
    });
    if (!vault) {
      throw new NotFoundException(`الخزنة ${vaultId} غير موجودة أو لا تنتمي لهذه الشركة`);
    }
    return vault.accountId;
  }

  /**
   * خريطة صريحة: نوع العملية → كود الحساب المحاسبي.
   *
   * الأكواد مُطابِقة لما يُنشئه seed.js:
   *   EXP-001 → مصروفات عامة        (expense)
   *   EXP-002 → موارد بشرية          (hr_expense | salary)
   *   EXP-003 → مصروفات ثابتة        (fixed_expense)
   *   EXP-004 → مصروفات المشتريات    (purchase)
   *   EMP-001 → سلفيات الموظفين      (advance) ← حساب أصول (asset)
   *
   * لإضافة نوع جديد: أضف الكود هنا وأنشئ الحساب في seed.js.
   */
  private static readonly KIND_TO_ACCOUNT_CODE: Record<string, string> = {
    purchase:      'PUR-001',   // بضاعة ومواد (مشتريات)
    expense:       'EXP-005',   // صيانة وتشغيل (مصروفات عامة)
    hr_expense:    'EXP-002',   // رسوم حكومية وإقامات
    fixed_expense: 'EXP-003',   // إيجار ومرافق
    salary:        'EXP-004',   // رواتب وأجور
    advance:       'EXP-001',   // سلفيات الموظفين (أصل/مديونية)
  };

  /**
   * يُحدد الحساب المدين بدقة باستخدام الخريطة الصريحة.
   *
   * أنواع الحسابات حسب Kind:
   *   expense | purchase | hr_expense | fixed_expense | salary → نوع expense
   *   advance → نوع asset (EMP-001: سلفيات الموظفين)
   *
   * أولوية: الخريطة الصريحة → fallback حسب نوع العملية.
   */
  private async _getDefaultExpenseAccount(
    tx:        TxClient,
    companyId: string,
    kind?:     string,
  ): Promise<string> {
    const targetCode = kind
      ? (FinancialCoreService.KIND_TO_ACCOUNT_CODE[kind] ?? 'EXP-001')
      : 'EXP-001';

    // محاولة 1: الحساب المُحدَّد بالكود الصريح (يعمل مع expense وasset على حد سواء)
    const specific = await tx.account.findFirst({
      where:  { companyId, code: targetCode, isActive: true },
      select: { id: true },
    });
    if (specific) return specific.id;

    // محاولة 2: fallback حسب نوع العملية
    // السلفية → أي حساب أصول | بقية العمليات → أي حساب مصروفات
    const fallbackType = kind === 'advance' ? 'asset' : 'expense';
    const fallback = await tx.account.findFirst({
      where:   { companyId, type: fallbackType, isActive: true },
      select:  { id: true },
      orderBy: { code: 'asc' },
    });
    if (!fallback) {
      throw new BadRequestException(
        `لم يُعثر على حساب (${targetCode}) للشركة ${companyId}. ` +
        `تأكد من تشغيل الـ Seed أو إنشاء الحسابات يدوياً في دليل الحسابات.`,
      );
    }
    return fallback.id;
  }

  private async _getDefaultRevenueAccount(tx: TxClient, companyId: string): Promise<string> {
    const account = await tx.account.findFirst({
      where:   { companyId, type: 'revenue', isActive: true },
      select:  { id: true },
      orderBy: { code: 'asc' },
    });
    if (!account) {
      throw new BadRequestException(
        `لم يُعثر على حساب إيرادات للشركة ${companyId}. يرجى إنشاء حساب من نوع "revenue" في دليل الحسابات.`,
      );
    }
    return account.id;
  }

  /** حساب ضريبة القيمة المضافة المحصلة (TAX-001) */
  private async _getVatCollectedAccount(tx: TxClient, companyId: string): Promise<string> {
    const account = await tx.account.findFirst({
      where:   { companyId, code: 'TAX-001', type: 'liability', isActive: true },
      select:  { id: true },
    });
    if (!account) {
      throw new BadRequestException(
        `لم يُعثر على حساب ضريبة القيمة المضافة (TAX-001) للشركة ${companyId}.`,
      );
    }
    return account.id;
  }

  // ══════════════════════════════════════════════════════════
  // PRIVATE: Validation & Helpers
  // ══════════════════════════════════════════════════════════

  /**
   * يُحل userId: الأولوية للـ callerUserId، ثم TenantContext.
   * يرفض العملية إذا كان المستخدم مجهول الهوية.
   */
  private _resolveUserId(callerUserId?: string): string {
    const userId = callerUserId ?? TenantContext.getUserId();
    if (!userId) {
      throw new UnauthorizedException(
        'FINANCIAL_OP_REQUIRES_USER_ID: لا يمكن تنفيذ عملية مالية بدون هوية مستخدم معروفة.',
      );
    }
    return userId;
  }

  /**
   * يُحل tenantId من TenantContext — مطلوب للـ RLS.
   * يرفض العملية إذا لم يكن هناك tenant context.
   */
  private _resolveTenantId(): string {
    try {
      return TenantContext.getTenantId();
    } catch {
      throw new UnauthorizedException(
        'FINANCIAL_OP_REQUIRES_TENANT_ID: لا يمكن تنفيذ عملية مالية خارج سياق المستأجر.',
      );
    }
  }

  private _buildDates(transactionDateStr: string) {
    return {
      entryDate: nowSaudi(),
      txDate:    new Date(transactionDateStr),
    };
  }

  /** لقطة فاتورة قابلة للـ JSON للحفظ في AuditLog */
  private _invoiceSnapshot(inv: Record<string, unknown>): Record<string, unknown> {
    return {
      id:              inv['id'],
      companyId:       inv['companyId'],
      supplierId:      inv['supplierId'],
      invoiceNumber:   inv['invoiceNumber'],
      kind:            inv['kind'],
      totalAmount:     String(inv['totalAmount']),
      netAmount:       String(inv['netAmount']),
      taxAmount:       String(inv['taxAmount']),
      transactionDate: inv['transactionDate'] instanceof Date
        ? (inv['transactionDate'] as Date).toISOString()
        : inv['transactionDate'],
      vaultId:         inv['vaultId'],
      batchId:         inv['batchId'],
      status:          inv['status'],
      entryDate:       inv['entryDate'] instanceof Date
        ? (inv['entryDate'] as Date).toISOString()
        : inv['entryDate'],
    };
  }
}

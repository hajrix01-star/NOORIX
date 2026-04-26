/**
 * دخل: الملخصات اليومية (processInflow، updateInflow)
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { splitTax } from '../common/utils/math-engine';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  assertOperationNotesLength,
  validateJournalBalance,
  type JsonObject,
} from './financial-core-helpers.util';
import { FinancialCoreSupportService } from './financial-core-support.service';
import type { InflowDto, SalesChannelDto } from './dto/financial-operation.dto';
import type { TxClient } from './financial-core-helpers.util';

@Injectable()
export class FinancialInflowService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly fiscalPeriod: FiscalPeriodService,
    private readonly idempotency: IdempotencyService,
    private readonly support: FinancialCoreSupportService,
  ) {}

  // 2. INFLOW — دخل: المبيعات اليومية (ملخص بقنوات متعددة)
  // ══════════════════════════════════════════════════════════
  /**
   * processInflow: ينشئ داخل transaction واحدة:
   *   [1] DailySalesSummary + DailySalesChannels
   *   [2] LedgerEntry لكل قناة بيع (مدين=خزنة، دائن=إيراد)
   *   [3] AuditLog
   */
  async processInflow(dto: InflowDto, callerUserId?: string) {
    const tenantId = this.support.resolveTenantId();
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

    const result = await this.support.withRetry(async () => this._processInflowInner(dto, callerUserId));

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
    assertOperationNotesLength(dto.notes);
    const userId   = this.support.resolveUserId(callerUserId);
    const tenantId = this.support.resolveTenantId();
    const { entryDate, txDate } = this.support.buildDates(dto.transactionDate);

    if (!dto.channels?.length) {
      throw new BadRequestException('يجب إدخال قناة بيع واحدة على الأقل.');
    }

    // منع التواريخ المستقبلية — نسمح بنهاية اليوم الحالي (23:59:59) فقط
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    if (txDate > todayEnd) {
      throw new BadRequestException('لا يمكن إدخال مبيعات بتاريخ مستقبلي.');
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
      const revenueAccountId = await this.support.getDefaultRevenueAccount(tx, dto.companyId);
      const vatAccountId = vatEnabled ? await this.support.getVatCollectedAccount(tx, dto.companyId) : null;

      // ── [C] الحصول على accountId لكل خزنة قناة بيع ────────
      const activeChannels = dto.channels.filter(
        (ch: { vaultId: string; amount: string }) => new Prisma.Decimal(ch.amount || '0').gt(0),
      );

      await this.support.assertVaultsUsableAsSalesPayment(
        tx,
        dto.companyId,
        activeChannels.map((ch: { vaultId: string; amount: string }) => ch.vaultId),
      );

      const vaultAccounts = await Promise.all(
        activeChannels.map((ch: { vaultId: string; amount: string }) => this.support.getVaultAccount(tx, dto.companyId, ch.vaultId)),
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
      // مثل فواتير الصرف: توزيعات خزنة لكل قناة — وإلا شاشة الفواتير تعرض vault_id للقناة الأولى فقط
      const saleInvoice = await tx.invoice.create({
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
          vaultId:             activeChannels.length === 1 ? activeChannels[0].vaultId : null,
          notes:               dto.notes ?? null,
          dailySalesSummaryId: summary.id,
          status:              'active',
          createdByUserId:     userId,
        },
      });
      await tx.invoiceVaultAllocation.createMany({
        data: activeChannels.map((ch: { vaultId: string; amount: string }) => ({
          tenantId,
          invoiceId: saleInvoice.id,
          vaultId:   ch.vaultId,
          amount:    new Prisma.Decimal(ch.amount),
        })),
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
    assertOperationNotesLength(dto.notes);
    const userId   = this.support.resolveUserId(callerUserId);
    const tenantId = this.support.resolveTenantId();
    const { entryDate, txDate } = this.support.buildDates(dto.transactionDate);

    // منع التواريخ المستقبلية في التحديثات أيضاً
    const todayEndForUpdate = new Date();
    todayEndForUpdate.setHours(23, 59, 59, 999);
    if (txDate > todayEndForUpdate) {
      throw new BadRequestException('لا يمكن تعديل ملخص مبيعات بتاريخ مستقبلي.');
    }

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
      // نتحقق من التاريخ الجديد أولاً قبل جلب الملخص
      await this.fiscalPeriod.assertPeriodOpenForDate(tx, companyId, txDate);

      const summary = await tx.dailySalesSummary.findFirst({
        where: { id: summaryId, companyId, status: 'active' },
      });
      if (!summary) {
        throw new NotFoundException('الملخص غير موجود أو تم إلغاؤه.');
      }

      // نتحقق أن الفترة الأصلية للملخص مفتوحة أيضاً —
      // يمنع نقل القيود من فترة مغلقة إلى فترة مفتوحة عبر تغيير transactionDate
      if (summary.transactionDate.getTime() !== txDate.getTime()) {
        await this.fiscalPeriod.assertPeriodOpenForDate(tx, companyId, summary.transactionDate);
      }

      await this.support.assertVaultsUsableAsSalesPayment(
        tx,
        companyId,
        activeChannels.map((ch: SalesChannelDto) => ch.vaultId),
      );

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
        await tx.invoiceVaultAllocation.deleteMany({ where: { invoiceId: saleInvoice.id } });
        await tx.invoiceVaultAllocation.createMany({
          data: activeChannels.map((ch: SalesChannelDto) => ({
            tenantId,
            invoiceId: saleInvoice.id,
            vaultId:   ch.vaultId,
            amount:    new Prisma.Decimal(ch.amount),
          })),
        });
        await tx.invoice.update({
          where: { id: saleInvoice.id },
          data:  {
            transactionDate: txDate,
            totalAmount,
            netAmount: vatEnabled ? totalNet : totalAmount,
            taxAmount: vatEnabled ? totalTax : new Prisma.Decimal(0),
            vaultId: activeChannels.length === 1 ? activeChannels[0].vaultId : null,
          },
        });
      }

      // ── [D] إنشاء قيود جديدة (إيراد + ضريبة إن وُجدت) ─────
      const revenueAccountId = await this.support.getDefaultRevenueAccount(tx, companyId);
      const vatAccountId = vatEnabled ? await this.support.getVatCollectedAccount(tx, companyId) : null;
      const vaultAccounts = await Promise.all(
        activeChannels.map((ch: SalesChannelDto) => this.support.getVaultAccount(tx, companyId, ch.vaultId)),
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
}

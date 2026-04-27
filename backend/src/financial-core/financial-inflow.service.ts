/**
 * دخل: الملخصات اليومية (processInflow، updateInflow)
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { assertOperationNotesLength, type JsonObject } from './financial-core-helpers.util';
import { FinancialCoreSupportService } from './financial-core-support.service';
import {
  assertInflowChannelsListNonEmpty,
  assertInflowNotFutureDate,
  assertInflowTotalPositive,
  buildChannelNetTaxForInflow,
  filterPositiveInflowChannels,
  sumInflowChannelAmounts,
} from './financial-inflow-channels.util';
import { createInflowSaleLedgerEntries } from './financial-inflow-ledger.util';
import type { InflowDto, SalesChannelDto } from './dto/financial-operation.dto';

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

    assertInflowChannelsListNonEmpty(dto.channels);
    assertInflowNotFutureDate(txDate);

    const totalAmount = sumInflowChannelAmounts(dto.channels!);
    assertInflowTotalPositive(totalAmount);

    const activeChannels = filterPositiveInflowChannels(dto.channels!);

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

      await this.support.assertVaultsUsableAsSalesPayment(
        tx,
        dto.companyId,
        activeChannels.map((ch) => ch.vaultId),
      );

      const vaultAccounts = await Promise.all(
        activeChannels.map((ch) => this.support.getVaultAccount(tx, dto.companyId, ch.vaultId)),
      );

      const { channelNetTax, totalNet, totalTax } = buildChannelNetTaxForInflow(
        activeChannels,
        vatEnabled,
        vatRateDecimal,
      );

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
            create: activeChannels.map((ch) => ({
              vaultId: ch.vaultId,
              amount:  new Prisma.Decimal(ch.amount),
            })),
          },
        },
      });

      // ── [E2] Create Invoice (kind=sale) مع الصافي والضريبة ──
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
        data: activeChannels.map((ch) => ({
          tenantId,
          invoiceId: saleInvoice.id,
          vaultId:   ch.vaultId,
          amount:    new Prisma.Decimal(ch.amount),
        })),
      });

      const ledgerEntries = await createInflowSaleLedgerEntries({
        tx,
        tenantId,
        companyId: dto.companyId,
        userId,
        entryDate,
        txDate,
        referenceId: summary.id,
        activeChannels,
        channelNetTax,
        vaultAccounts,
        revenueAccountId,
        vatAccountId,
        vatEnabled,
        collectResults: true,
      });

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

    assertInflowNotFutureDate(txDate);

    const totalAmount = sumInflowChannelAmounts(dto.channels);
    assertInflowTotalPositive(totalAmount);

    const activeChannels = filterPositiveInflowChannels(dto.channels);
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

      if (summary.transactionDate.getTime() !== txDate.getTime()) {
        await this.fiscalPeriod.assertPeriodOpenForDate(tx, companyId, summary.transactionDate);
      }

      await this.support.assertVaultsUsableAsSalesPayment(
        tx,
        companyId,
        activeChannels.map((ch: SalesChannelDto) => ch.vaultId),
      );

      await tx.ledgerEntry.updateMany({
        where: {
          companyId:     companyId,
          referenceType: 'sale',
          referenceId:   summaryId,
          status:       'active',
        },
        data: { status: 'cancelled' },
      });

      await tx.dailySalesChannel.deleteMany({ where: { summaryId } });
      await tx.dailySalesChannel.createMany({
        data: activeChannels.map((ch: SalesChannelDto) => ({
          summaryId,
          vaultId: ch.vaultId,
          amount:  new Prisma.Decimal(ch.amount),
        })),
      });

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

      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { vatEnabledForSales: true, vatRatePercent: true },
      });
      const vatEnabled = !!company?.vatEnabledForSales;
      const vatRateDecimal = company?.vatRatePercent != null ? Number(company.vatRatePercent) / 100 : 0.15;

      const { channelNetTax, totalNet, totalTax } = buildChannelNetTaxForInflow(
        activeChannels,
        vatEnabled,
        vatRateDecimal,
      );

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

      const revenueAccountId = await this.support.getDefaultRevenueAccount(tx, companyId);
      const vatAccountId = vatEnabled ? await this.support.getVatCollectedAccount(tx, companyId) : null;
      const vaultAccounts = await Promise.all(
        activeChannels.map((ch: SalesChannelDto) => this.support.getVaultAccount(tx, companyId, ch.vaultId)),
      );

      await createInflowSaleLedgerEntries({
        tx,
        tenantId,
        companyId,
        userId,
        entryDate,
        txDate,
        referenceId: summaryId,
        activeChannels,
        channelNetTax,
        vaultAccounts,
        revenueAccountId,
        vatAccountId,
        vatEnabled,
        collectResults: false,
      });

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

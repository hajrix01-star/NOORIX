import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { assertOperationNotesLength } from './financial-core-helpers.util';
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
import type { InflowDto, SalesChannelDto, SalesShift } from './dto/financial-operation.dto';
import { assertValidInflowBatch } from './financial-inflow-batch.util';
import { resolveVatRateDecimal } from '@noorix/finance-core';
import type { TxClient } from './financial-core-helpers.util';
import { resolveSalesDayContextSnapshot, salesDayContextJson } from '../sales/sales-day-context.util';
import { createInflowSummaryAuditLog, updateInflowSummaryAuditLog } from './financial-inflow-audit.util';
import {
  createInflowSaleInvoiceWithAllocations,
  updateInflowSaleInvoiceWithAllocations,
} from './financial-inflow-invoice.util';
import {
  assertNoActiveSummaryForShift,
  buildDailySalesSummaryNumber,
  normalizeInflowSalesShift,
} from './financial-inflow-summary.util';

@Injectable()
export class FinancialInflowService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly fiscalPeriod: FiscalPeriodService,
    private readonly idempotency: IdempotencyService,
    private readonly support: FinancialCoreSupportService,
  ) {}

  async processInflow(dto: InflowDto, callerUserId?: string) {
    const tenantId = this.support.resolveTenantId();
    if (dto.idempotencyKey) {
      const keyHash = this.idempotency.hashKey('processInflow', {
        companyId:       dto.companyId,
        transactionDate: dto.transactionDate,
        shift:           normalizeInflowSalesShift(dto.shift),
        channels:        dto.channels,
        idempotencyKey:  dto.idempotencyKey,
      });
      return this.idempotency.withIdempotency(
        tenantId,
        dto.companyId,
        keyHash,
        () => this.support.withRetry(() => this._processInflowInner(dto, callerUserId)),
      ) as Promise<Awaited<ReturnType<typeof this._processInflowInner>>>;
    }
    return this.support.withRetry(async () => this._processInflowInner(dto, callerUserId));
  }

  async processInflowBatch(dtos: InflowDto[], callerUserId?: string, batchIdempotencyKey?: string) {
    assertValidInflowBatch(dtos);
    if (dtos.length === 1) {
      const single = await this.processInflow(dtos[0], callerUserId);
      return { summaries: [single.summary] };
    }

    const tenantId = this.support.resolveTenantId();
    const companyId = dtos[0].companyId;

    if (batchIdempotencyKey) {
      const keyHash = this.idempotency.hashKey('processInflowBatch', {
        companyId,
        transactionDate: dtos[0].transactionDate,
        itemCount:       dtos.length,
        shifts:          dtos.map((d) => normalizeInflowSalesShift(d.shift)).join(','),
        idempotencyKey:  batchIdempotencyKey,
      });
      return this.idempotency.withIdempotency(
        tenantId,
        companyId,
        keyHash,
        () => this.support.withRetry(() => this._processInflowBatchInner(dtos, callerUserId)),
      ) as Promise<{ summaries: Awaited<ReturnType<typeof this._processInflowInTx>>['summary'][] }>;
    }

    return this.support.withRetry(() => this._processInflowBatchInner(dtos, callerUserId));
  }

  private async _processInflowBatchInner(dtos: InflowDto[], callerUserId?: string) {
    const { txDate } = this.support.buildDates(dtos[0].transactionDate);
    return this.db.withTenant(async (tx) => {
      await this.fiscalPeriod.assertPeriodOpenForDate(tx, dtos[0].companyId, txDate);
      const summaries = [];
      for (const dto of dtos) {
        const { summary } = await this._processInflowInTx(tx as TxClient, dto, callerUserId);
        summaries.push(summary);
      }
      return { summaries };
    });
  }

  private async _processInflowInner(dto: InflowDto, callerUserId?: string) {
    assertOperationNotesLength(dto.notes);
    const { txDate } = this.support.buildDates(dto.transactionDate);

    assertInflowChannelsListNonEmpty(dto.channels);
    assertInflowNotFutureDate(txDate);

    const totalAmount = sumInflowChannelAmounts(dto.channels!);
    assertInflowTotalPositive(totalAmount);

    return this.db.withTenant(async (tx) => {
      await this.fiscalPeriod.assertPeriodOpenForDate(tx, dto.companyId, txDate);
      return this._processInflowInTx(tx as TxClient, dto, callerUserId);
    });
  }

  private async _processInflowInTx(tx: TxClient, dto: InflowDto, callerUserId?: string) {
    assertOperationNotesLength(dto.notes);
    const userId   = this.support.resolveUserId(callerUserId);
    const tenantId = this.support.resolveTenantId();
    const { entryDate, txDate } = this.support.buildDates(dto.transactionDate);

    assertInflowChannelsListNonEmpty(dto.channels);
    assertInflowNotFutureDate(txDate);
    const totalAmount = sumInflowChannelAmounts(dto.channels!);
    assertInflowTotalPositive(totalAmount);
    const activeChannels = filterPositiveInflowChannels(dto.channels!);
    const shift = normalizeInflowSalesShift(dto.shift);
    await assertNoActiveSummaryForShift({ tx, companyId: dto.companyId, transactionDate: txDate, shift });

    const summaryNumber = await buildDailySalesSummaryNumber(tx, dto.companyId, dto.transactionDate);

    const company = await tx.company.findUnique({
        where: { id: dto.companyId },
        select: { vatEnabledForSales: true, vatRatePercent: true },
      });
      const vatEnabled = !!company?.vatEnabledForSales;
      const vatRateDecimal = resolveVatRateDecimal(company?.vatRatePercent).toNumber();

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
      const dayContext = await resolveSalesDayContextSnapshot(tx, dto.companyId, txDate);

      const summary = await tx.dailySalesSummary.create({
        data: {
          tenantId,
          companyId:       dto.companyId,
          summaryNumber,
          transactionDate: txDate,
          customerCount:   dto.customerCount || 0,
          shift,
          cashOnHand:      new Prisma.Decimal(dto.cashOnHand || '0'),
          totalAmount,
          notes:           dto.notes ?? null,
          dayContext:      salesDayContextJson(dayContext),
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

      await createInflowSaleInvoiceWithAllocations({
        tx,
        tenantId,
        companyId: dto.companyId,
        userId,
        summaryId: summary.id,
        summaryNumber,
        entryDate,
        txDate,
        totalAmount,
        totalNet,
        totalTax,
        vatEnabled,
        activeChannels,
        notes: dto.notes,
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

      await createInflowSummaryAuditLog({
        tx,
        tenantId,
        companyId: dto.companyId,
        userId,
        entryDate,
        summaryId: summary.id,
        summaryNumber,
        totalAmount,
        customerCount: dto.customerCount,
        shift,
        activeChannels,
      });

      return { summary, ledgerEntries };
  }

  async updateInflow(
    summaryId: string,
    companyId: string,
    dto: {
      transactionDate: string;
      customerCount: number;
      cashOnHand: string;
      channels: { vaultId: string; amount: string }[];
      notes?: string;
      shift?: SalesShift;
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
      throw new BadRequestException('ÙŠØ¬Ø¨ Ø¥Ø¯Ø®Ø§Ù„ Ù‚Ù†Ø§Ø© Ø¨ÙŠØ¹ ÙˆØ§Ø­Ø¯Ø© Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„.');
    }

    return this.db.withTenant(async (tx) => {
      await this.fiscalPeriod.assertPeriodOpenForDate(tx, companyId, txDate);

      const summary = await tx.dailySalesSummary.findFirst({
        where: { id: summaryId, companyId, status: 'active' },
      });
      if (!summary) {
        throw new NotFoundException('Ø§Ù„Ù…Ù„Ø®Øµ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯ Ø£Ùˆ ØªÙ… Ø¥Ù„ØºØ§Ø¤Ù‡.');
      }

      if (summary.transactionDate.getTime() !== txDate.getTime()) {
        await this.fiscalPeriod.assertPeriodOpenForDate(tx, companyId, summary.transactionDate);
      }

      const shift = dto.shift ?? normalizeInflowSalesShift(summary.shift);
      await assertNoActiveSummaryForShift({ tx, companyId, transactionDate: txDate, shift, excludeId: summaryId });

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
      const dayContext = await resolveSalesDayContextSnapshot(tx, companyId, txDate);

      await tx.dailySalesSummary.update({
        where: { id: summaryId },
        data:  {
          transactionDate: txDate,
          customerCount:   dto.customerCount,
          shift,
          cashOnHand:      new Prisma.Decimal(dto.cashOnHand || '0'),
          totalAmount,
          notes:           dto.notes ?? null,
          dayContext:      salesDayContextJson(dayContext),
        },
      });

      const company = await tx.company.findUnique({
        where: { id: companyId },
        select: { vatEnabledForSales: true, vatRatePercent: true },
      });
      const vatEnabled = !!company?.vatEnabledForSales;
      const vatRateDecimal = resolveVatRateDecimal(company?.vatRatePercent).toNumber();

      const { channelNetTax, totalNet, totalTax } = buildChannelNetTaxForInflow(
        activeChannels,
        vatEnabled,
        vatRateDecimal,
      );

      await updateInflowSaleInvoiceWithAllocations({
        tx,
        tenantId,
        companyId,
        summaryId,
        txDate,
        totalAmount,
        totalNet,
        totalTax,
        vatEnabled,
        activeChannels,
      });

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

      await updateInflowSummaryAuditLog({
        tx,
        tenantId,
        companyId,
        userId,
        entryDate,
        summaryId,
        totalAmount,
        customerCount: dto.customerCount,
        shift,
        activeChannels,
      });

      const updated = await tx.dailySalesSummary.findUnique({
        where: { id: summaryId },
        include: { channels: true },
      });
      return updated;
    });
  }

}

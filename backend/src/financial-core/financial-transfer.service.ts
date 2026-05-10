/**
 * تحويل نقدي بين خزنات
 */
import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { assertOperationNotesLength, validateJournalBalance } from './financial-core-helpers.util';
import { FinancialCoreSupportService } from './financial-core-support.service';
import type { TransferDto } from './dto/financial-operation.dto';
import type { TxClient } from './financial-core-helpers.util';

@Injectable()
export class FinancialTransferService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly fiscalPeriod: FiscalPeriodService,
    private readonly idempotency: IdempotencyService,
    private readonly support: FinancialCoreSupportService,
  ) {}

  // 3. TRANSFER — تحويل بين خزائن
  // ══════════════════════════════════════════════════════════
  /**
   * processTransfer: ينشئ LedgerEntry واحداً:
   *   debit  = خزنة المستقبِل (رصيدها يزيد)
   *   credit = خزنة المُرسِل  (رصيدها يقل)
   */
  async processTransfer(dto: TransferDto, callerUserId?: string) {
    const tenantId = this.support.resolveTenantId();
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
      const result = await this.support.withRetry(async () => this._processTransferInner(dto, callerUserId));
      await this.idempotency.storeResult(tenantId, dto.companyId, keyHash, result);
      return result;
    }
    return this.support.withRetry(async () => this._processTransferInner(dto, callerUserId));
  }

  private async _processTransferInner(dto: TransferDto, callerUserId?: string) {
    assertOperationNotesLength(dto.notes);
    const userId   = this.support.resolveUserId(callerUserId);
    const tenantId = this.support.resolveTenantId();
    const { entryDate, txDate } = this.support.buildDates(dto.transactionDate);

    if (dto.fromVaultId === dto.toVaultId) {
      throw new BadRequestException('لا يمكن التحويل من خزنة لنفسها.');
    }

    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) {
      throw new BadRequestException('مبلغ التحويل يجب أن يكون أكبر من صفر.');
    }

    return this.db.withTenant(async (tx) => {
      await this.fiscalPeriod.assertPeriodOpenForDate(tx, dto.companyId, txDate);

      await this.support.assertVaultTransferEndpoints(tx, dto.companyId, dto.fromVaultId, dto.toVaultId);

      const [fromAccountId, toAccountId] = await Promise.all([
        this.support.getVaultAccount(tx, dto.companyId, dto.fromVaultId),
        this.support.getVaultAccount(tx, dto.companyId, dto.toVaultId),
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
}

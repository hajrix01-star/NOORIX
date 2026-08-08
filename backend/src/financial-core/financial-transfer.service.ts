import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { nowSaudi } from '../common/utils/date-utils';
import { assertOperationNotesLength, validateJournalBalance } from './financial-core-helpers.util';
import { FinancialCoreSupportService } from './financial-core-support.service';
import type { ReverseTransferDto, TransferDto } from './dto/financial-operation.dto';

type PreparedTransfer = {
  companyId: string;
  fromVaultId: string;
  toVaultId: string;
  amount: Prisma.Decimal;
  transactionDate: Date;
  transactionDateYmd: string;
  notes: string | null;
  idempotencyKey: string;
  requestHash: string;
};

type PreparedReversal = {
  companyId: string;
  transferId: string;
  transactionDate: Date;
  transactionDateYmd: string;
  reason: string | null;
  idempotencyKey: string;
  requestHash: string;
};

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function sha256(value: Record<string, unknown>): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function parseYmd(value: string): { ymd: string; date: Date } {
  const ymd = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new BadRequestException('تاريخ العملية يجب أن يكون بصيغة YYYY-MM-DD');
  }
  const date = new Date(`${ymd}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== ymd) {
    throw new BadRequestException('تاريخ العملية غير صحيح');
  }
  return { ymd, date };
}

function normalizeAmount(value: string): Prisma.Decimal {
  const normalized = String(value || '').trim().replace(',', '.');
  let amount: Prisma.Decimal;
  try {
    amount = new Prisma.Decimal(normalized);
  } catch {
    throw new BadRequestException('مبلغ التحويل غير صحيح');
  }
  amount = amount.toDecimalPlaces(4);
  if (!amount.isFinite() || amount.lte(0)) {
    throw new BadRequestException('مبلغ التحويل يجب أن يكون أكبر من صفر');
  }
  return amount;
}

@Injectable()
export class FinancialTransferService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly fiscalPeriod: FiscalPeriodService,
    private readonly support: FinancialCoreSupportService,
  ) {}

  /**
   * Posts one immutable internal-transfer voucher and one balanced ledger entry.
   * The voucher reserves idempotency inside the same DB transaction as the ledger.
   */
  async processTransfer(dto: TransferDto, callerUserId?: string) {
    const prepared = this.prepareTransfer(dto);
    try {
      return await this.support.withRetry(() => this.postTransfer(prepared, callerUserId));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return this.resolveExistingAttempt(prepared.companyId, prepared.idempotencyKey, prepared.requestHash);
    }
  }

  /** Creates an immutable opposite voucher/entry and marks the original voucher reversed. */
  async reverseTransfer(dto: ReverseTransferDto, callerUserId?: string) {
    const prepared = this.prepareReversal(dto);
    try {
      return await this.support.withRetry(() => this.postReversal(prepared, callerUserId));
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const byKey = await this.db.vaultTransfer.findFirst({
        where: { companyId: prepared.companyId, idempotencyKey: prepared.idempotencyKey },
        include: { ledgerEntry: true },
      });
      if (byKey) return this.assertSameRequest(byKey, prepared.requestHash);
      throw new ConflictException('تم عكس التحويل مسبقاً');
    }
  }

  private prepareTransfer(dto: TransferDto): PreparedTransfer {
    assertOperationNotesLength(dto.notes);
    const idempotencyKey = String(dto.idempotencyKey || '').trim();
    if (!idempotencyKey) throw new BadRequestException('مفتاح منع تكرار التحويل مطلوب');
    if (idempotencyKey.length > 200) throw new BadRequestException('مفتاح منع التكرار طويل جداً');
    if (dto.fromVaultId === dto.toVaultId) {
      throw new BadRequestException('لا يمكن التحويل من خزينة لنفسها');
    }
    const amount = normalizeAmount(dto.amount);
    const { ymd, date } = parseYmd(dto.transactionDate);
    const notes = dto.notes?.trim() || null;
    const requestHash = sha256({
      operation: 'vault-transfer',
      companyId: dto.companyId,
      fromVaultId: dto.fromVaultId,
      toVaultId: dto.toVaultId,
      amount: amount.toFixed(4),
      transactionDate: ymd,
      notes,
    });
    return {
      companyId: dto.companyId,
      fromVaultId: dto.fromVaultId,
      toVaultId: dto.toVaultId,
      amount,
      transactionDate: date,
      transactionDateYmd: ymd,
      notes,
      idempotencyKey,
      requestHash,
    };
  }

  private prepareReversal(dto: ReverseTransferDto): PreparedReversal {
    assertOperationNotesLength(dto.reason);
    const idempotencyKey = String(dto.idempotencyKey || '').trim();
    if (!idempotencyKey) throw new BadRequestException('مفتاح منع تكرار عكس التحويل مطلوب');
    if (idempotencyKey.length > 200) throw new BadRequestException('مفتاح منع التكرار طويل جداً');
    const { ymd, date } = parseYmd(dto.transactionDate);
    const reason = dto.reason?.trim() || null;
    return {
      companyId: dto.companyId,
      transferId: dto.transferId,
      transactionDate: date,
      transactionDateYmd: ymd,
      reason,
      idempotencyKey,
      requestHash: sha256({
        operation: 'vault-transfer-reversal',
        companyId: dto.companyId,
        transferId: dto.transferId,
        transactionDate: ymd,
        reason,
      }),
    };
  }

  private async postTransfer(prepared: PreparedTransfer, callerUserId?: string) {
    const userId = this.support.resolveUserId(callerUserId);
    const tenantId = this.support.resolveTenantId();
    const entryDate = nowSaudi();

    return this.db.withTenant(async (tx) => {
      const existing = await tx.vaultTransfer.findFirst({
        where: { companyId: prepared.companyId, idempotencyKey: prepared.idempotencyKey },
        include: { ledgerEntry: true },
      });
      if (existing) return this.assertSameRequest(existing, prepared.requestHash);

      await this.fiscalPeriod.assertPeriodOpenForDate(tx, prepared.companyId, prepared.transactionDate);
      await this.support.assertVaultTransferEndpoints(
        tx,
        prepared.companyId,
        prepared.fromVaultId,
        prepared.toVaultId,
      );
      const [fromAccountId, toAccountId] = await Promise.all([
        this.support.getVaultAccount(tx, prepared.companyId, prepared.fromVaultId),
        this.support.getVaultAccount(tx, prepared.companyId, prepared.toVaultId),
      ]);

      validateJournalBalance([{ amount: prepared.amount }], [{ amount: prepared.amount }]);
      const transferNumber = `TRF-${prepared.transactionDateYmd.replaceAll('-', '')}-${cryptoRandomSuffix()}`;
      const transfer = await tx.vaultTransfer.create({
        data: {
          tenantId,
          companyId: prepared.companyId,
          transferNumber,
          fromVaultId: prepared.fromVaultId,
          toVaultId: prepared.toVaultId,
          amount: prepared.amount,
          transactionDate: prepared.transactionDate,
          entryDate,
          notes: prepared.notes,
          status: 'posted',
          idempotencyKey: prepared.idempotencyKey,
          requestHash: prepared.requestHash,
          createdById: userId,
        },
      });
      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          tenantId,
          companyId: prepared.companyId,
          debitAccountId: toAccountId,
          creditAccountId: fromAccountId,
          amount: prepared.amount,
          transactionDate: prepared.transactionDate,
          entryDate,
          referenceType: 'transfer',
          referenceId: transfer.id,
          vaultId: prepared.toVaultId,
          createdById: userId,
          status: 'active',
        },
      });
      const completed = await tx.vaultTransfer.update({
        where: { id: transfer.id },
        data: { ledgerEntryId: ledgerEntry.id },
        include: { ledgerEntry: true },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          companyId: prepared.companyId,
          userId,
          action: 'create',
          entity: 'vault_transfer',
          entityId: transfer.id,
          newValue: {
            transferNumber,
            fromVaultId: prepared.fromVaultId,
            toVaultId: prepared.toVaultId,
            amount: prepared.amount.toFixed(4),
            transactionDate: prepared.transactionDateYmd,
            notes: prepared.notes,
            ledgerEntryId: ledgerEntry.id,
            status: 'posted',
          },
          createdAt: entryDate,
        },
      });
      return this.toResult(completed);
    });
  }

  private async postReversal(prepared: PreparedReversal, callerUserId?: string) {
    const userId = this.support.resolveUserId(callerUserId);
    const tenantId = this.support.resolveTenantId();
    const entryDate = nowSaudi();

    return this.db.withTenant(async (tx) => {
      const byKey = await tx.vaultTransfer.findFirst({
        where: { companyId: prepared.companyId, idempotencyKey: prepared.idempotencyKey },
        include: { ledgerEntry: true },
      });
      if (byKey) return this.assertSameRequest(byKey, prepared.requestHash);

      const original = await tx.vaultTransfer.findFirst({
        where: { id: prepared.transferId, companyId: prepared.companyId },
        include: { ledgerEntry: true, reversal: { include: { ledgerEntry: true } } },
      });
      if (!original) throw new NotFoundException('سند التحويل غير موجود');
      if (original.reversalOfId) throw new BadRequestException('لا يمكن عكس سند العكس');
      if (original.status !== 'posted' || original.reversal) {
        throw new ConflictException('تم عكس التحويل مسبقاً');
      }
      if (prepared.transactionDate < original.transactionDate) {
        throw new BadRequestException('تاريخ العكس لا يمكن أن يسبق تاريخ التحويل الأصلي');
      }

      await this.fiscalPeriod.assertPeriodOpenForDate(tx, prepared.companyId, prepared.transactionDate);
      await this.support.assertVaultTransferReversalEndpoints(
        tx,
        prepared.companyId,
        original.toVaultId,
        original.fromVaultId,
      );
      const [reversalFromAccountId, reversalToAccountId] = await Promise.all([
        this.support.getVaultAccount(tx, prepared.companyId, original.toVaultId),
        this.support.getVaultAccount(tx, prepared.companyId, original.fromVaultId),
      ]);
      validateJournalBalance([{ amount: original.amount }], [{ amount: original.amount }]);

      const transferNumber = `TRV-${prepared.transactionDateYmd.replaceAll('-', '')}-${cryptoRandomSuffix()}`;
      const reversal = await tx.vaultTransfer.create({
        data: {
          tenantId,
          companyId: prepared.companyId,
          transferNumber,
          fromVaultId: original.toVaultId,
          toVaultId: original.fromVaultId,
          amount: original.amount,
          transactionDate: prepared.transactionDate,
          entryDate,
          notes: prepared.reason,
          status: 'posted',
          idempotencyKey: prepared.idempotencyKey,
          requestHash: prepared.requestHash,
          reversalOfId: original.id,
          createdById: userId,
        },
      });
      const ledgerEntry = await tx.ledgerEntry.create({
        data: {
          tenantId,
          companyId: prepared.companyId,
          debitAccountId: reversalToAccountId,
          creditAccountId: reversalFromAccountId,
          amount: original.amount,
          transactionDate: prepared.transactionDate,
          entryDate,
          referenceType: 'transfer',
          referenceId: reversal.id,
          vaultId: original.fromVaultId,
          createdById: userId,
          status: 'active',
        },
      });
      const completed = await tx.vaultTransfer.update({
        where: { id: reversal.id },
        data: { ledgerEntryId: ledgerEntry.id },
        include: { ledgerEntry: true },
      });
      await tx.vaultTransfer.update({
        where: { id: original.id },
        data: { status: 'reversed', reversedAt: entryDate },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          companyId: prepared.companyId,
          userId,
          action: 'reverse',
          entity: 'vault_transfer',
          entityId: original.id,
          oldValue: { status: 'posted' },
          newValue: {
            status: 'reversed',
            reversalTransferId: reversal.id,
            reversalTransferNumber: transferNumber,
            reason: prepared.reason,
            reversedAt: entryDate.toISOString(),
          },
          createdAt: entryDate,
        },
      });
      return this.toResult(completed);
    });
  }

  private async resolveExistingAttempt(companyId: string, idempotencyKey: string, requestHash: string) {
    const existing = await this.db.vaultTransfer.findFirst({
      where: { companyId, idempotencyKey },
      include: { ledgerEntry: true },
    });
    if (!existing) throw new ConflictException('تعذر حجز مفتاح منع التكرار');
    return this.assertSameRequest(existing, requestHash);
  }

  private assertSameRequest<T extends { requestHash: string; transferNumber: string; ledgerEntry: unknown }>(
    transfer: T,
    requestHash: string,
  ) {
    if (transfer.requestHash !== requestHash) {
      throw new ConflictException('مفتاح منع التكرار مستخدم لطلب تحويل مختلف');
    }
    return this.toResult(transfer);
  }

  private toResult<T extends { transferNumber: string; ledgerEntry: unknown }>(transfer: T) {
    return {
      transfer,
      ledgerEntry: transfer.ledgerEntry,
      referenceId: transfer.transferNumber,
    };
  }
}

function cryptoRandomSuffix(): string {
  return createHash('sha256')
    .update(`${Date.now()}:${Math.random()}:${process.hrtime.bigint()}`)
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();
}

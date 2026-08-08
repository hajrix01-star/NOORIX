import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { TenantContext } from '../common/tenant-context';
import { nowSaudi } from '../common/utils/date-utils';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateLoanDto, CreateLoanPaymentDto, ReverseLoanPaymentDto } from './dto/loan.dto';
import {
  postLoanOpeningLedger,
  postLoanPaymentLedger,
  postLoanPaymentReversalLedger,
} from '../financial-core/financial-loan-ledger.util';

function dateOf(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException('التاريخ غير صحيح');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new BadRequestException('التاريخ غير صحيح');
  return date;
}

function money(value: number) {
  const amount = new Prisma.Decimal(String(value)).toDecimalPlaces(4);
  if (!amount.isFinite() || amount.lte(0)) throw new BadRequestException('المبلغ يجب أن يكون أكبر من صفر');
  return amount;
}

function requestHash(payload: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function ensureMatchingReplay(actual: string, expected: string) {
  if (actual !== expected) throw new ConflictException('مفتاح العملية مستخدم لبيانات مختلفة');
}

function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class LoansService {
  constructor(private readonly db: TenantPrismaService, private readonly fiscal: FiscalPeriodService) {}

  list(companyId: string) {
    return this.db.loan.findMany({
      where: { companyId, isActive: true },
      include: {
        payments: {
          include: { vault: { select: { nameAr: true, nameEn: true } }, reversal: true, reversalOf: true },
          orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        },
      },
      orderBy: { openingDate: 'asc' },
    });
  }

  async create(companyId: string, dto: CreateLoanDto, userId: string) {
    const amount = money(dto.amount);
    const openingDate = dateOf(dto.openingDate);
    const dueDate = dto.dueDate ? dateOf(dto.dueDate) : null;
    const historicalPaidThroughDate = dto.historicalPaidThroughDate ? dateOf(dto.historicalPaidThroughDate) : null;
    const historicalPaidAmount = dto.historicalPaidAmount == null ? new Prisma.Decimal(0) : new Prisma.Decimal(String(dto.historicalPaidAmount)).toDecimalPlaces(4);
    const historicalPaymentsCount = dto.historicalPaymentsCount ?? 0;
    const idempotencyKey = dto.idempotencyKey.trim();
    if (dueDate && dueDate < openingDate) throw new BadRequestException('تاريخ الاستحقاق لا يسبق تاريخ التمويل');
    if (historicalPaidThroughDate && historicalPaidThroughDate > openingDate) throw new BadRequestException('تاريخ الدفعات السابقة يجب أن يكون في أو قبل تاريخ بداية المتابعة');
    if (historicalPaidAmount.lt(0)) throw new BadRequestException('إجمالي الدفعات السابقة غير صحيح');
    const hash = requestHash({ nameAr: dto.nameAr.trim(), creditorName: dto.creditorName?.trim() || null, amount: amount.toFixed(4), openingDate: dto.openingDate, dueDate: dto.dueDate || null, notes: dto.notes?.trim() || null, historicalPaymentsCount, historicalPaidAmount: historicalPaidAmount.toFixed(4), historicalPaidThroughDate: dto.historicalPaidThroughDate || null });

    const create = () => this.db.withTenant(async (tx) => {
      const existing = await tx.loan.findFirst({ where: { companyId, idempotencyKey } });
      if (existing) { ensureMatchingReplay(existing.requestHash, hash); return existing; }
      await this.fiscal.assertPeriodOpenForDate(tx, companyId, openingDate);
      const [loanAccount, openingBalanceAccount] = await Promise.all([
        tx.account.findFirst({ where: { companyId, code: 'LOAN-001', type: 'liability', isActive: true } }),
        tx.account.findFirst({ where: { companyId, code: 'EQU-002', type: 'equity', isActive: true } }),
      ]);
      if (!loanAccount || !openingBalanceAccount) throw new BadRequestException('حساب التمويل أو تسوية الرصيد الافتتاحي غير مهيأ');
      const tenantId = TenantContext.getTenantId();
      const loan = await tx.loan.create({ data: { tenantId, companyId, nameAr: dto.nameAr.trim(), creditorName: dto.creditorName?.trim() || null, openingAmount: amount, outstandingAmount: amount, historicalPaymentsCount, historicalPaidAmount, historicalPaidThroughDate, openingDate, dueDate, notes: dto.notes?.trim() || null, createdById: userId, idempotencyKey, requestHash: hash } });
      const ledger = await postLoanOpeningLedger(tx, { tenantId, companyId, openingBalanceAccountId: openingBalanceAccount.id, loanAccountId: loanAccount.id, amount, transactionDate: openingDate, entryDate: nowSaudi(), referenceId: loan.id, createdById: userId });
      const completed = await tx.loan.update({ where: { id: loan.id }, data: { openingLedgerEntryId: ledger.id } });
      await tx.auditLog.create({ data: { tenantId, companyId, userId, action: 'create', entity: 'loan', entityId: loan.id, newValue: { amount: amount.toFixed(4), openingLedgerEntryId: ledger.id, historicalPaymentsCount, historicalPaidAmount: historicalPaidAmount.toFixed(4), policy: 'unified_contract_balance' } } });
      return completed;
    });

    try { return await create(); } catch (error) {
      if (!isUniqueError(error)) throw error;
      return this.db.withTenant(async (tx) => {
        const existing = await tx.loan.findFirst({ where: { companyId, idempotencyKey } });
        if (!existing) throw error;
        ensureMatchingReplay(existing.requestHash, hash);
        return existing;
      });
    }
  }

  async pay(id: string, companyId: string, dto: CreateLoanPaymentDto, userId: string) {
    const amount = money(dto.amount);
    const transactionDate = dateOf(dto.transactionDate);
    const idempotencyKey = dto.idempotencyKey.trim();
    const hash = requestHash({ loanId: id, vaultId: dto.vaultId, amount: amount.toFixed(4), transactionDate: dto.transactionDate, notes: dto.notes?.trim() || null, action: 'pay' });
    const create = () => this.db.withTenant(async (tx) => {
      const existing = await tx.loanPayment.findFirst({ where: { companyId, idempotencyKey } });
      if (existing) { ensureMatchingReplay(existing.requestHash, hash); return existing; }
      await this.fiscal.assertPeriodOpenForDate(tx, companyId, transactionDate);
      const [loan, vault, loanAccount] = await Promise.all([
        tx.loan.findFirst({ where: { id, companyId, isActive: true } }),
        tx.vault.findFirst({ where: { id: dto.vaultId, companyId, isActive: true, isArchived: false, showAsPaymentMethod: true } }),
        tx.account.findFirst({ where: { companyId, code: 'LOAN-001', type: 'liability', isActive: true } }),
      ]);
      if (!loan) throw new NotFoundException('التمويل غير موجود');
      if (!vault?.accountId || !loanAccount) throw new BadRequestException('الخزينة أو حساب التمويل غير مهيأ');
      const changed = await tx.loan.updateMany({ where: { id, companyId, outstandingAmount: { gte: amount } }, data: { outstandingAmount: { decrement: amount } } });
      if (changed.count !== 1) throw new ConflictException('دفعة السداد تتجاوز الرصيد المتبقي؛ حدّث الصفحة ثم أعد المحاولة');
      const tenantId = TenantContext.getTenantId();
      const paymentId = randomUUID();
      const ledger = await postLoanPaymentLedger(tx, { tenantId, companyId, loanAccountId: loanAccount.id, vaultAccountId: vault.accountId, vaultId: vault.id, amount, transactionDate, entryDate: nowSaudi(), referenceId: paymentId, createdById: userId });
      const payment = await tx.loanPayment.create({ data: { id: paymentId, tenantId, companyId, loanId: id, vaultId: vault.id, ledgerEntryId: ledger.id, amount, transactionDate, notes: dto.notes?.trim() || null, createdById: userId, idempotencyKey, requestHash: hash } });
      await tx.auditLog.create({ data: { tenantId, companyId, userId, action: 'create', entity: 'loan_payment', entityId: payment.id, newValue: { loanId: id, amount: amount.toFixed(4), ledgerEntryId: ledger.id } } });
      return payment;
    });

    try { return await create(); } catch (error) {
      if (!isUniqueError(error)) throw error;
      return this.db.withTenant(async (tx) => {
        const existing = await tx.loanPayment.findFirst({ where: { companyId, idempotencyKey } });
        if (!existing) throw error;
        ensureMatchingReplay(existing.requestHash, hash);
        return existing;
      });
    }
  }

  async reversePayment(id: string, paymentId: string, companyId: string, dto: ReverseLoanPaymentDto, userId: string) {
    const transactionDate = dateOf(dto.transactionDate);
    const idempotencyKey = dto.idempotencyKey.trim();
    const hash = requestHash({ loanId: id, paymentId, transactionDate: dto.transactionDate, notes: dto.notes?.trim() || null, action: 'reverse' });
    const create = () => this.db.withTenant(async (tx) => {
      const replay = await tx.loanPayment.findFirst({ where: { companyId, idempotencyKey } });
      if (replay) { ensureMatchingReplay(replay.requestHash, hash); return replay; }
      const original = await tx.loanPayment.findFirst({ where: { id: paymentId, loanId: id, companyId, status: 'posted', reversalOfId: null }, include: { reversal: true, vault: true } });
      if (!original) throw new NotFoundException('دفعة السداد غير موجودة أو أُلغيت');
      if (original.reversal) throw new ConflictException('هذه الدفعة ملغاة بالفعل');
      if (transactionDate < original.transactionDate) throw new BadRequestException('تاريخ الإلغاء لا يسبق تاريخ السداد');
      await this.fiscal.assertPeriodOpenForDate(tx, companyId, transactionDate);
      if (!original.vault.accountId) throw new BadRequestException('خزينة السداد غير مهيأة');
      const loanAccount = await tx.account.findFirst({ where: { companyId, code: 'LOAN-001', type: 'liability', isActive: true } });
      if (!loanAccount) throw new BadRequestException('حساب التمويل غير مهيأ');
      const loan = await tx.loan.findFirst({ where: { id, companyId, isActive: true } });
      if (!loan) throw new NotFoundException('التمويل غير موجود');
      const tenantId = TenantContext.getTenantId();
      const reversalId = randomUUID();
      const ledger = await postLoanPaymentReversalLedger(tx, { tenantId, companyId, loanAccountId: loanAccount.id, vaultAccountId: original.vault.accountId, vaultId: original.vaultId, amount: original.amount, transactionDate, entryDate: nowSaudi(), referenceId: reversalId, createdById: userId });
      const reversal = await tx.loanPayment.create({ data: { id: reversalId, tenantId, companyId, loanId: id, vaultId: original.vaultId, ledgerEntryId: ledger.id, amount: original.amount, transactionDate, notes: dto.notes?.trim() || null, createdById: userId, idempotencyKey, requestHash: hash, reversalOfId: original.id } });
      await tx.loan.update({ where: { id }, data: { outstandingAmount: { increment: original.amount } } });
      await tx.loanPayment.update({ where: { id: original.id }, data: { status: 'reversed', reversedAt: nowSaudi() } });
      await tx.auditLog.create({ data: { tenantId, companyId, userId, action: 'cancel', entity: 'loan_payment', entityId: original.id, newValue: { reversalPaymentId: reversal.id, ledgerEntryId: ledger.id } } });
      return reversal;
    });

    try { return await create(); } catch (error) {
      if (!isUniqueError(error)) throw error;
      return this.db.withTenant(async (tx) => {
        const replay = await tx.loanPayment.findFirst({ where: { companyId, idempotencyKey } });
        if (replay) { ensureMatchingReplay(replay.requestHash, hash); return replay; }
        const reversal = await tx.loanPayment.findFirst({ where: { companyId, reversalOfId: paymentId } });
        if (reversal) throw new ConflictException('هذه الدفعة ملغاة بالفعل');
        throw error;
      });
    }
  }
}

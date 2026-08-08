import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { TenantContext } from '../common/tenant-context';
import { nowSaudi } from '../common/utils/date-utils';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateLoanDto, CreateLoanPaymentDto, MigrateLoanLegacyInvoicesDto, ReverseLoanPaymentDto } from './dto/loan.dto';
import {
  cancelLegacyLoanExpenseInvoices,
  postLoanOpeningLedger,
  postLoanPaymentLedger,
  postLoanPaymentReversalLedger,
  replaceLoanOpeningLedger,
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
          include: { vault: { select: { nameAr: true, nameEn: true } }, sourceInvoice: { select: { invoiceNumber: true } }, reversal: true, reversalOf: true },
          orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
        },
        legacyInvoices: { orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }] },
      },
      orderBy: { openingDate: 'asc' },
    });
  }

  async migrateLegacyInvoices(id: string, companyId: string, dto: MigrateLoanLegacyInvoicesDto, userId: string) {
    return this.db.withTenant(async (tx) => {
      const [loan, line] = await Promise.all([
        tx.loan.findFirst({ where: { id, companyId, isActive: true } }),
        tx.expenseLine.findFirst({ where: { id: dto.expenseLineId, companyId } }),
      ]);
      if (!loan) throw new NotFoundException('القرض غير موجود');
      if (!line) throw new NotFoundException('بند المصروف القديم غير موجود');
      const invoices = await tx.invoice.findMany({
        where: { companyId, expenseLineId: line.id, status: 'active', kind: { in: ['expense', 'fixed_expense'] } },
        select: { id: true, invoiceNumber: true, transactionDate: true, totalAmount: true },
        orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
      });
      if (!invoices.length) throw new BadRequestException('لا توجد فواتير نشطة قابلة للترحيل لهذا البند');
      const existing = await tx.loanLegacyInvoice.findMany({ where: { invoiceId: { in: invoices.map((invoice) => invoice.id) } }, select: { invoiceId: true, loanId: true } });
      if (existing.some((row) => row.loanId !== id)) throw new ConflictException('بعض الفواتير مرتبطة بقرض آخر ولا يمكن نقلها');
      const known = new Set(existing.map((row) => row.invoiceId));
      const pending = invoices.filter((invoice) => !known.has(invoice.id));
      const tenantId = TenantContext.getTenantId();
      if (pending.length) await tx.loanLegacyInvoice.createMany({ data: pending.map((invoice) => ({ tenantId, companyId, loanId: id, invoiceId: invoice.id, sourceExpenseLineId: line.id, invoiceNumber: invoice.invoiceNumber, transactionDate: invoice.transactionDate, amount: invoice.totalAmount })) });
      if (dto.archiveExpenseLine !== false && line.isActive) await tx.expenseLine.update({ where: { id: line.id }, data: { isActive: false } });
      await tx.auditLog.create({ data: { tenantId, companyId, userId, action: 'migrate', entity: 'loan_legacy_invoices', entityId: id, newValue: { sourceExpenseLineId: line.id, created: pending.length, alreadyLinked: known.size, archivedExpenseLine: dto.archiveExpenseLine !== false } } });
      return { created: pending.length, alreadyLinked: known.size, total: invoices.length, archivedExpenseLine: dto.archiveExpenseLine !== false };
    });
  }

  /**
   * يعيد تصنيف فواتير أقساط قرض قديمة دون حذفها:
   * - الفاتورة وقيود المصروف تُعطّل وتبقى قابلة للتدقيق.
   * - ينشأ بدل كل قيد صرف سداد قرض بنفس التاريخ والخزينة والمبلغ.
   * - يُستبدل قيد الرصيد الافتتاحي بمبلغ أعلى بالمجموع نفسه، لذلك لا يتغير المتبقي.
   */
  async convertLegacyInvoicesToPayments(id: string, companyId: string, userId: string) {
    return this.db.withTenant(async (tx) => {
      const loan = await tx.loan.findFirst({ where: { id, companyId, isActive: true } });
      if (!loan) throw new NotFoundException('القرض غير موجود');
      if (!loan.openingLedgerEntryId) throw new BadRequestException('قيد الرصيد الافتتاحي للقرض غير موجود');

      const legacyRows = await tx.loanLegacyInvoice.findMany({
        where: { companyId, loanId: id, convertedAt: null },
        orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
      });
      if (!legacyRows.length) return { converted: 0, totalAmount: '0.0000', outstandingAmount: loan.outstandingAmount.toFixed(4), alreadyConverted: true };

      const invoiceIds = legacyRows.map((row) => row.invoiceId);
      const invoices = await tx.invoice.findMany({
        where: { id: { in: invoiceIds }, companyId, status: 'active', kind: { in: ['expense', 'fixed_expense'] } },
        select: { id: true, invoiceNumber: true, totalAmount: true, transactionDate: true },
      });
      if (invoices.length !== invoiceIds.length) throw new BadRequestException('بعض فواتير القرض غير نشطة أو لا يمكن إعادة تصنيفها');

      // قيد الصرف الأصلي هو المصدر الوحيد للخزينة والمبلغ: لا نعتمد على حالة الخزينة الحالية.
      const sourceLedgers = await tx.ledgerEntry.findMany({
        where: { companyId, referenceType: 'invoice', referenceId: { in: invoiceIds }, status: 'active' },
        select: { id: true, referenceId: true, amount: true, transactionDate: true, vaultId: true, creditAccountId: true },
        orderBy: [{ transactionDate: 'asc' }, { createdAt: 'asc' }],
      });
      if (sourceLedgers.length === 0 || sourceLedgers.some((entry) => !entry.vaultId)) {
        throw new BadRequestException('لا يمكن تحويل فاتورة قرض بلا قيد خزينة مكتمل');
      }
      const summedByInvoice = new Map<string, Prisma.Decimal>();
      for (const entry of sourceLedgers) summedByInvoice.set(entry.referenceId, (summedByInvoice.get(entry.referenceId) ?? new Prisma.Decimal(0)).plus(entry.amount));
      if (invoices.some((invoice) => !(summedByInvoice.get(invoice.id) ?? new Prisma.Decimal(0)).eq(invoice.totalAmount))) {
        throw new BadRequestException('مبلغ قيد خزينة إحدى الفواتير لا يطابق مبلغها؛ لم يتم إجراء أي تحويل');
      }

      const sourceVaultIds = [...new Set(sourceLedgers.map((entry) => entry.vaultId!))];
      const vaults = await tx.vault.findMany({ where: { id: { in: sourceVaultIds }, companyId }, select: { id: true, accountId: true } });
      if (vaults.length !== sourceVaultIds.length || vaults.some((vault) => !vault.accountId)) throw new BadRequestException('خزينة إحدى الفواتير القديمة غير مكتملة');
      const openingLedger = await tx.ledgerEntry.findFirst({
        where: { id: loan.openingLedgerEntryId, companyId, status: 'active', referenceType: 'loan_opening', referenceId: id },
        select: { id: true, amount: true, debitAccountId: true, creditAccountId: true, transactionDate: true },
      });
      const [loanAccount, openingBalanceAccount] = await Promise.all([
        tx.account.findFirst({ where: { companyId, code: 'LOAN-001', type: 'liability', isActive: true } }),
        tx.account.findFirst({ where: { companyId, code: 'EQU-002', type: 'equity', isActive: true } }),
      ]);
      if (!openingLedger || !loanAccount || !openingBalanceAccount
        || openingLedger.creditAccountId !== loanAccount.id || openingLedger.debitAccountId !== openingBalanceAccount.id
        || !openingLedger.amount.eq(loan.openingAmount)) {
        throw new BadRequestException('قيد الرصيد الافتتاحي للقرض غير متسق؛ لم يتم إجراء أي تحويل');
      }

      const total = sourceLedgers.reduce((sum, entry) => sum.plus(entry.amount), new Prisma.Decimal(0));
      const newOpeningAmount = loan.openingAmount.plus(total);
      const tenantId = TenantContext.getTenantId();
      const entryDate = nowSaudi();

      // نلغي الأثر القديم ثم نستبدله في نفس العملية؛ لا حذف ولا حركة خزينة إضافية.
      const replacementOpening = await replaceLoanOpeningLedger(tx, openingLedger.id, {
        tenantId, companyId, openingBalanceAccountId: openingBalanceAccount.id, loanAccountId: loanAccount.id,
        amount: newOpeningAmount, transactionDate: openingLedger.transactionDate, entryDate, referenceId: id, createdById: userId,
      });
      await cancelLegacyLoanExpenseInvoices(tx, companyId, invoiceIds, sourceLedgers.map((entry) => entry.id));

      for (const source of sourceLedgers) {
        const paymentId = randomUUID();
        const ledger = await postLoanPaymentLedger(tx, {
          tenantId, companyId, loanAccountId: loanAccount.id, vaultAccountId: source.creditAccountId,
          vaultId: source.vaultId!, amount: source.amount, transactionDate: source.transactionDate,
          entryDate, referenceId: paymentId, createdById: userId,
        });
        const invoice = invoices.find((row) => row.id === source.referenceId)!;
        await tx.loanPayment.create({ data: {
          id: paymentId, tenantId, companyId, loanId: id, vaultId: source.vaultId!, ledgerEntryId: ledger.id,
          amount: source.amount, transactionDate: source.transactionDate,
          notes: `إعادة تصنيف الفاتورة ${invoice.invoiceNumber} إلى سداد قرض`, createdById: userId,
          idempotencyKey: `loan-legacy-${id}-${source.id}`, requestHash: requestHash({ action: 'legacy-invoice-reclass', loanId: id, sourceLedgerEntryId: source.id }),
          sourceInvoiceId: source.referenceId, sourceLedgerEntryId: source.id,
        } });
      }
      await tx.loan.update({ where: { id }, data: { openingAmount: newOpeningAmount, openingLedgerEntryId: replacementOpening.id } });
      await tx.loanLegacyInvoice.updateMany({ where: { id: { in: legacyRows.map((row) => row.id) }, convertedAt: null }, data: { convertedAt: entryDate, convertedById: userId } });
      for (const invoice of invoices) {
        await tx.auditLog.create({ data: { tenantId, companyId, userId, action: 'cancel', entity: 'invoice', entityId: invoice.id, newValue: { reason: 'reclassified_as_loan_payment', loanId: id, invoiceNumber: invoice.invoiceNumber } } });
      }
      await tx.auditLog.create({ data: { tenantId, companyId, userId, action: 'migrate', entity: 'loan_legacy_invoices', entityId: id, newValue: { action: 'reclassified_as_loan_payments', invoiceCount: invoices.length, paymentCount: sourceLedgers.length, totalAmount: total.toFixed(4), previousOpeningAmount: loan.openingAmount.toFixed(4), newOpeningAmount: newOpeningAmount.toFixed(4), outstandingAmount: loan.outstandingAmount.toFixed(4) } } });
      return { converted: sourceLedgers.length, invoiceCount: invoices.length, totalAmount: total.toFixed(4), outstandingAmount: loan.outstandingAmount.toFixed(4), alreadyConverted: false };
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

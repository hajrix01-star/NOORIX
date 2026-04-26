/**
 * صرف: processOutflow، الدفعة، وإعادة بناء قيود الفواتير.
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { generateInvoiceSerial } from '../common/utils/invoice-serial';
import { FiscalPeriodService } from '../fiscal-period/fiscal-period.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import {
  assertOperationNotesLength,
  validateJournalBalance,
  type JsonObject,
} from './financial-core-helpers.util';
import { FinancialCoreSupportService } from './financial-core-support.service';
import type { OutflowDto } from './dto/financial-operation.dto';
import type { TxClient } from './financial-core-helpers.util';

@Injectable()
export class FinancialOutflowService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly fiscalPeriod: FiscalPeriodService,
    private readonly idempotency: IdempotencyService,
    private readonly support: FinancialCoreSupportService,
  ) {}

  async processOutflow(dto: OutflowDto, callerUserId?: string) {
    const tenantId = this.support.resolveTenantId();
    if (dto.idempotencyKey) {
      const vaultSplitsSig =
        dto.vaultSplits?.length ?
          [...dto.vaultSplits].map((s) => `${s.vaultId}:${s.amount}`).sort().join('|')
        : '';
      const keyHash = this.idempotency.hashKey('processOutflow', {
        companyId:             dto.companyId,
        kind:                  dto.kind,
        totalAmount:           dto.totalAmount,
        transactionDate:       dto.transactionDate,
        supplierId:            dto.supplierId,
        supplierInvoiceNumber: dto.supplierInvoiceNumber,
        vaultId:               dto.vaultId,
        vaultSplitsSig,
        employeeId:            dto.employeeId,
        expenseLineId:         dto.expenseLineId,
        expenseCoverageYear:   dto.expenseCoverageYear,
        expenseCoverageQuarter: dto.expenseCoverageQuarter,
        expenseCoverageMonthStart: dto.expenseCoverageMonthStart,
        expenseMonthsCovered: dto.expenseMonthsCovered,
        warrantyFollowUp:     dto.warrantyFollowUp === true,
        idempotencyKey:        dto.idempotencyKey,
      });
      const cached = await this.idempotency.getCachedResult(tenantId, dto.companyId, keyHash);
      if (cached) return cached as Awaited<ReturnType<typeof this._processOutflowInner>>;
      const result = await this.support.withRetry(async () => this._processOutflowInner(dto, callerUserId));
      await this.idempotency.storeResult(tenantId, dto.companyId, keyHash, result);
      return result;
    }
    return this.support.withRetry(async () => this._processOutflowInner(dto, callerUserId));
  }

  private async _processOutflowInner(dto: OutflowDto, callerUserId?: string) {
    assertOperationNotesLength(dto.notes);
    const userId   = this.support.resolveUserId(callerUserId);
    const tenantId = this.support.resolveTenantId();
    const { entryDate, txDate } = this.support.buildDates(dto.transactionDate);

    return this.db.withTenant(async (tx) => {
      // السيريال يُولَّد دائماً من النظام — لا يُقبل من العميل
      const invoiceNumber = dto.invoiceNumber || await generateInvoiceSerial(tx, dto.companyId, dto.kind, txDate);
      await this.fiscalPeriod.assertPeriodOpenForDate(tx, dto.companyId, txDate);

      const splits = await this.support.resolveOutflowVaultSplits(tx, dto.companyId, dto);
      const debitAccountId =
        dto.debitAccountId ?? (await this.support.getDefaultExpenseAccount(tx, dto.companyId, dto.kind));
      /** خزنة واحدة على الفاتورة فقط عند سداد أحادي — عند التعدد null لتجنب التضليل */
      const invoiceVaultId = splits.length === 1 ? splits[0].vaultId : null;

      const referenceType =
        dto.kind === 'salary' ? 'salary' : dto.kind === 'advance' ? 'advance' : 'invoice';

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
          vaultId:               invoiceVaultId,
          batchId:               dto.batchId ?? null,
          notes:                 dto.notes ?? null,
          installmentCount:      dto.installmentCount ?? null,
          installmentAmount:     dto.installmentAmount ? new Prisma.Decimal(dto.installmentAmount) : null,
          expenseCoverageYear:       dto.expenseCoverageYear ?? null,
          expenseCoverageQuarter:    dto.expenseCoverageQuarter ?? null,
          expenseCoverageMonthStart: dto.expenseCoverageMonthStart ?? null,
          expenseMonthsCovered:      dto.expenseMonthsCovered ?? null,
          warrantyFollowUp:          dto.warrantyFollowUp === true,
          warrantyFollowUpDone:      false,
          status:                'active',
          createdByUserId:       userId,
        },
      });

      // ── [C] قيود + تخصيصات خزنة (قيد لكل جزء) ───────────
      const ledgerEntries: Awaited<ReturnType<typeof tx.ledgerEntry.create>>[] = [];
      validateJournalBalance(
        [{ amount: new Prisma.Decimal(String(dto.totalAmount)) }],
        splits.map((s) => ({ amount: s.amount })),
      );
      for (const split of splits) {
        const creditAccountId = await this.support.getVaultAccount(tx, dto.companyId, split.vaultId);
        const ledgerEntry = await tx.ledgerEntry.create({
          data: {
            tenantId,
            companyId:       dto.companyId,
            debitAccountId,
            creditAccountId,
            amount:          split.amount,
            transactionDate: txDate,
            entryDate,
            referenceType,
            referenceId:     invoice.id,
            vaultId:         split.vaultId,
            employeeId:      dto.employeeId ?? null,
            createdById:     userId,
            status:          'active',
          },
        });
        ledgerEntries.push(ledgerEntry);

        await tx.invoiceVaultAllocation.create({
          data: {
            tenantId,
            invoiceId: invoice.id,
            vaultId:   split.vaultId,
            amount:    split.amount,
          },
        });
      }

      // ── [D] Create AuditLog (بصمة المستخدم) ─────────────
      await tx.auditLog.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          userId,
          action:    'create',
          entity:    'invoice',
          entityId:  invoice.id,
          newValue:  this.support.invoiceSnapshot(invoice) as JsonObject,
          createdAt: entryDate,
        },
      });

      return { invoice, ledgerEntry: ledgerEntries[0]!, ledgerEntries };
    });
  }

  /**
   * processOutflowBatch: إنشاء دفعة فواتير في transaction واحدة.
   * فشل أي فاتورة → Rollback الكل.
   * batchIdempotencyKey — مفتاح عدم التكرار على مستوى الدفعة كاملة
   */
  async processOutflowBatch(dtos: OutflowDto[], callerUserId?: string, batchIdempotencyKey?: string) {
    const tenantId = this.support.resolveTenantId();
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
    const userId = this.support.resolveUserId(callerUserId);
    return this.db.withTenant(async (tx) => {
      const results = [];
      for (const dto of dtos) {
        assertOperationNotesLength(dto.notes);
        const { entryDate, txDate } = this.support.buildDates(dto.transactionDate);
        const serial = dto.invoiceNumber || await generateInvoiceSerial(tx, dto.companyId, dto.kind, txDate);
        await this.fiscalPeriod.assertPeriodOpenForDate(tx, dto.companyId, txDate);

        const splits = await this.support.resolveOutflowVaultSplits(tx, dto.companyId, dto);
        const debitAccountId =
          dto.debitAccountId ?? (await this.support.getDefaultExpenseAccount(tx, dto.companyId, dto.kind));
        const invoiceVaultId = splits.length === 1 ? splits[0].vaultId : null;
        const referenceType =
          dto.kind === 'salary' ? 'salary' : dto.kind === 'advance' ? 'advance' : 'invoice';

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
            vaultId:         invoiceVaultId,
            batchId:               dto.batchId ?? null,
            notes:                 dto.notes ?? null,
            installmentCount:      dto.installmentCount ?? null,
            installmentAmount:     dto.installmentAmount ? new Prisma.Decimal(dto.installmentAmount) : null,
            expenseCoverageYear:       dto.expenseCoverageYear ?? null,
            expenseCoverageQuarter:    dto.expenseCoverageQuarter ?? null,
            expenseCoverageMonthStart: dto.expenseCoverageMonthStart ?? null,
            expenseMonthsCovered:      dto.expenseMonthsCovered ?? null,
            warrantyFollowUp:          dto.warrantyFollowUp === true,
            warrantyFollowUpDone:      false,
            status:                'active',
            createdByUserId:       userId,
          },
        });

        validateJournalBalance(
          [{ amount: new Prisma.Decimal(String(dto.totalAmount)) }],
          splits.map((s) => ({ amount: s.amount })),
        );
        for (const split of splits) {
          const creditAccountId = await this.support.getVaultAccount(tx, dto.companyId, split.vaultId);
          await tx.ledgerEntry.create({
            data: {
              tenantId,
              companyId:       dto.companyId,
              debitAccountId,
              creditAccountId,
              amount:          split.amount,
              transactionDate: txDate,
              entryDate,
              referenceType,
              referenceId:     invoice.id,
              vaultId:         split.vaultId,
              employeeId:      dto.employeeId ?? null,
              createdById:     userId,
              status:          'active',
            },
          });
          await tx.invoiceVaultAllocation.create({
            data: {
              tenantId,
              invoiceId: invoice.id,
              vaultId:   split.vaultId,
              amount:    split.amount,
            },
          });
        }

        await tx.auditLog.create({
          data: {
            tenantId,
            companyId: dto.companyId,
            userId,
            action:    'create',
            entity:    'invoice',
            entityId:  invoice.id,
            newValue:  this.support.invoiceSnapshot(invoice) as JsonObject,
            createdAt: entryDate,
          },
        });

        results.push({ invoice, ledgerEntry: null });
      }
      return results;
    });
  }

  /**
   * إعادة بناء قيود الصرف وتخصيصات الخزنة عند تغيير الخزنة أو توزيع الخزائن من تعديل الفاتورة.
   * يُستدعى داخل نفس transaction تحديث الفاتورة (بعد تحديث صف الفاتورة والمبالغ).
   */
  async rebuildOutflowInvoiceLedgerAfterVaultChange(
    tx: TxClient,
    companyId: string,
    invoiceId: string,
    opts: {
      vaultId?: string | null;
      vaultSplits?: Array<{ vaultId: string; amount: number }> | null;
    },
    callerUserId?: string,
    ledgerOpts?: { preserveDebitAccount?: boolean },
  ): Promise<void> {
    const userId = this.support.resolveUserId(callerUserId);

    const inv = await tx.invoice.findFirstOrThrow({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        tenantId: true,
        kind: true,
        status: true,
        totalAmount: true,
        netAmount: true,
        taxAmount: true,
        transactionDate: true,
        entryDate: true,
        dailySalesSummaryId: true,
        employeeId: true,
      },
    });

    if (inv.kind === 'sale' || inv.dailySalesSummaryId) {
      return;
    }
    if (inv.status !== 'active') {
      throw new BadRequestException('لا يمكن تعديل خزنة فاتورة غير نشطة.');
    }

    const hasVaultSplits = opts.vaultSplits != null && opts.vaultSplits.length > 0;
    const hasVaultId =
      opts.vaultId != null && String(opts.vaultId).trim() !== '';
    if (!hasVaultSplits && !hasVaultId) {
      throw new BadRequestException('حدد خزنة أو توزيع خزائن لتحديث القيود.');
    }

    const txDateStr = inv.transactionDate.toISOString().slice(0, 10);
    await this.fiscalPeriod.assertPeriodOpenForDate(tx, companyId, inv.transactionDate);

    const txDto: OutflowDto = {
      companyId,
      kind: inv.kind,
      totalAmount: inv.totalAmount.toString(),
      netAmount: inv.netAmount.toString(),
      taxAmount: inv.taxAmount.toString(),
      transactionDate: txDateStr,
      ...(hasVaultSplits
        ? {
            vaultSplits: opts.vaultSplits!.map((s) => ({
              vaultId: s.vaultId,
              amount:  String(s.amount),
            })),
          }
        : { vaultId: opts.vaultId! }),
    };

    const splits = await this.support.resolveOutflowVaultSplits(tx, companyId, txDto);

    const first = await tx.ledgerEntry.findFirst({
      where: {
        companyId,
        referenceId: invoiceId,
        referenceType: { in: ['invoice', 'salary', 'advance'] },
        status: 'active',
      },
      orderBy: { createdAt: 'asc' },
      select: { entryDate: true, debitAccountId: true },
    });
    const entryDate = first?.entryDate ?? inv.entryDate;
    const debitAccountId =
      ledgerOpts?.preserveDebitAccount === false
        ? await this.support.getDefaultExpenseAccount(tx, companyId, inv.kind)
        : first?.debitAccountId ??
          (await this.support.getDefaultExpenseAccount(tx, companyId, inv.kind));

    const referenceType =
      inv.kind === 'salary' ? 'salary' : inv.kind === 'advance' ? 'advance' : 'invoice';

    await this._replaceOutflowInvoiceLedgerAndAllocations(
      tx,
      companyId,
      inv,
      invoiceId,
      splits,
      debitAccountId,
      entryDate,
      referenceType,
      userId,
    );
  }

  /**
   * إعادة بناء قيود الصرف لتطابق مبالغ الفاتورة الحالية (بعد تعديل الإجمالي/الصافي/الضريبة أو نوع المصروف)
   * دون تغيير توزيع الخزائن نسبياً عند التعدد؛ خزنة واحدة أو بلا تخصيصات تُحلّ كما في الإنشاء.
   */
  async rebuildOutflowInvoiceLedgerToMatchInvoice(
    tx: TxClient,
    companyId: string,
    invoiceId: string,
    callerUserId?: string,
    ledgerOpts?: { preserveDebitAccount?: boolean },
  ): Promise<void> {
    const userId = this.support.resolveUserId(callerUserId);

    const inv = await tx.invoice.findFirstOrThrow({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        tenantId: true,
        kind: true,
        status: true,
        totalAmount: true,
        netAmount: true,
        taxAmount: true,
        transactionDate: true,
        entryDate: true,
        dailySalesSummaryId: true,
        employeeId: true,
        vaultId: true,
        vaultAllocations: {
          orderBy: { id: 'asc' },
          select:  { vaultId: true, amount: true },
        },
      },
    });

    if (inv.kind === 'sale' || inv.dailySalesSummaryId) {
      return;
    }
    if (inv.status !== 'active') {
      throw new BadRequestException('لا يمكن تعديل قيود فاتورة غير نشطة.');
    }

    await this.fiscalPeriod.assertPeriodOpenForDate(tx, companyId, inv.transactionDate);

    const newTotal = new Prisma.Decimal(inv.totalAmount);
    const allocs = inv.vaultAllocations ?? [];

    let splits: Array<{ vaultId: string; amount: Prisma.Decimal }>;
    if (allocs.length >= 2) {
      splits = this._scaleVaultAllocationsToTotal(
        allocs.map((a) => ({
          vaultId: a.vaultId,
          amount:  new Prisma.Decimal(a.amount),
        })),
        newTotal,
      );
    } else if (allocs.length === 1) {
      splits = [{ vaultId: allocs[0].vaultId, amount: newTotal }];
    } else {
      const txDateStr = inv.transactionDate.toISOString().slice(0, 10);
      const txDto: OutflowDto = {
        companyId,
        kind: inv.kind,
        totalAmount: inv.totalAmount.toString(),
        netAmount: inv.netAmount.toString(),
        taxAmount: inv.taxAmount.toString(),
        transactionDate: txDateStr,
        ...(inv.vaultId ? { vaultId: inv.vaultId } : {}),
      };
      splits = await this.support.resolveOutflowVaultSplits(tx, companyId, txDto);
    }

    const first = await tx.ledgerEntry.findFirst({
      where: {
        companyId,
        referenceId: invoiceId,
        referenceType: { in: ['invoice', 'salary', 'advance'] },
        status: 'active',
      },
      orderBy: { createdAt: 'asc' },
      select: { entryDate: true, debitAccountId: true },
    });
    const entryDate = first?.entryDate ?? inv.entryDate;
    const debitAccountId =
      ledgerOpts?.preserveDebitAccount === false
        ? await this.support.getDefaultExpenseAccount(tx, companyId, inv.kind)
        : first?.debitAccountId ??
          (await this.support.getDefaultExpenseAccount(tx, companyId, inv.kind));

    const referenceType =
      inv.kind === 'salary' ? 'salary' : inv.kind === 'advance' ? 'advance' : 'invoice';

    await this._replaceOutflowInvoiceLedgerAndAllocations(
      tx,
      companyId,
      inv,
      invoiceId,
      splits,
      debitAccountId,
      entryDate,
      referenceType,
      userId,
    );
  }

  /** توزيع نسبي للمبالغ على الخزائن عند تعدد التخصيصات بعد تغيير إجمالي الفاتورة */
  private _scaleVaultAllocationsToTotal(
    rows: Array<{ vaultId: string; amount: Prisma.Decimal }>,
    newTotal: Prisma.Decimal,
  ): Array<{ vaultId: string; amount: Prisma.Decimal }> {
    if (rows.length === 0) {
      return [];
    }
    if (rows.length === 1) {
      return [{ vaultId: rows[0].vaultId, amount: newTotal }];
    }
    const oldSum = rows.reduce((acc, r) => acc.plus(r.amount), new Prisma.Decimal(0));
    if (oldSum.lte(0)) {
      throw new BadRequestException('مجموع تخصيصات الخزنة السابقة غير صالح لتعديل المبلغ.');
    }
    const result: Array<{ vaultId: string; amount: Prisma.Decimal }> = [];
    let acc = new Prisma.Decimal(0);
    for (let i = 0; i < rows.length; i++) {
      if (i === rows.length - 1) {
        result.push({ vaultId: rows[i].vaultId, amount: newTotal.minus(acc) });
      } else {
        const raw = rows[i].amount.mul(newTotal).div(oldSum);
        const rounded = new Prisma.Decimal(raw.toFixed(4));
        result.push({ vaultId: rows[i].vaultId, amount: rounded });
        acc = acc.plus(rounded);
      }
    }
    return result;
  }

  private async _replaceOutflowInvoiceLedgerAndAllocations(
    tx: TxClient,
    companyId: string,
    inv: {
      tenantId: string;
      id: string;
      transactionDate: Date;
      employeeId: string | null;
      totalAmount: Prisma.Decimal;
    },
    invoiceId: string,
    splits: Array<{ vaultId: string; amount: Prisma.Decimal }>,
    debitAccountId: string,
    entryDate: Date,
    referenceType: string,
    userId: string,
  ): Promise<void> {
    await tx.invoiceVaultAllocation.deleteMany({ where: { invoiceId } });
    await tx.ledgerEntry.deleteMany({
      where: {
        companyId,
        referenceId: invoiceId,
        referenceType: { in: ['invoice', 'salary', 'advance'] },
        status: 'active',
      },
    });

    validateJournalBalance(
      [{ amount: inv.totalAmount }],
      splits.map((s) => ({ amount: s.amount })),
    );
    for (const split of splits) {
      const creditAccountId = await this.support.getVaultAccount(tx, companyId, split.vaultId);
      await tx.ledgerEntry.create({
        data: {
          tenantId: inv.tenantId,
          companyId,
          debitAccountId,
          creditAccountId,
          amount: split.amount,
          transactionDate: inv.transactionDate,
          entryDate,
          referenceType,
          referenceId: invoiceId,
          vaultId: split.vaultId,
          employeeId: inv.employeeId ?? null,
          createdById: userId,
          status: 'active',
        },
      });

      await tx.invoiceVaultAllocation.create({
        data: {
          tenantId: inv.tenantId,
          invoiceId: inv.id,
          vaultId: split.vaultId,
          amount: split.amount,
        },
      });
    }
  }

  // ══════════════════════════════════════════════════════════
}

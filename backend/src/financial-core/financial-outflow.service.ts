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
} from './financial-core-helpers.util';
import { FinancialCoreSupportService } from './financial-core-support.service';
import {
  replaceOutflowInvoiceLedgerAndAllocations,
  scaleVaultAllocationsToTotal,
} from './financial-outflow-ledger.util';
import { persistOutflowInvoiceWithLedger } from './financial-outflow-persist.util';
import { reportingClassForOutflowKind, type LedgerReportingClass } from './financial-reporting-classification.util';
import { toYmd } from '../common/utils/to-ymd.util';
import type { OutflowDto } from './dto/financial-operation.dto';
import type { TxClient } from './financial-core-helpers.util';
import { assertOutflowBatchNoDuplicateSupplierInvoiceKeys } from '../invoice/invoice-supplier-invoice-dedup.util';

@Injectable()
export class FinancialOutflowService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly fiscalPeriod: FiscalPeriodService,
    private readonly idempotency: IdempotencyService,
    private readonly support: FinancialCoreSupportService,
  ) {}

  /** Internal-only posting path for a centrally owned reporting classification. */
  async processOutflowWithReportingClass(
    dto: OutflowDto,
    reportingClass: LedgerReportingClass,
    callerUserId?: string,
  ) {
    return this.processOutflow(dto, callerUserId, reportingClass);
  }

  async processOutflow(
    dto: OutflowDto,
    callerUserId?: string,
    reportingClassOverride?: LedgerReportingClass,
  ) {
    const tenantId = this.support.resolveTenantId();
    if (dto.idempotencyKey) {
      const vaultSplitsSig =
        dto.vaultSplits?.length
          ? [...dto.vaultSplits].map((s) => `${s.vaultId}:${s.amount}`).sort().join('|')
          : '';
      const keyHash = this.idempotency.hashKey('processOutflow', {
        companyId:                 dto.companyId,
        kind:                      dto.kind,
        totalAmount:               dto.totalAmount,
        transactionDate:           dto.transactionDate,
        supplierId:                dto.supplierId,
        supplierInvoiceNumber:     dto.supplierInvoiceNumber,
        vaultId:                   dto.vaultId,
        vaultSplitsSig,
        employeeId:                dto.employeeId,
        expenseLineId:             dto.expenseLineId,
        expenseCoverageYear:       dto.expenseCoverageYear,
        expenseCoverageQuarter:    dto.expenseCoverageQuarter,
        expenseCoverageMonthStart: dto.expenseCoverageMonthStart,
        expenseMonthsCovered:      dto.expenseMonthsCovered,
        warrantyFollowUp:          dto.warrantyFollowUp === true,
        idempotencyKey:            dto.idempotencyKey,
        reportingClassOverride,
      });
      return this.idempotency.withIdempotency(
        tenantId,
        dto.companyId,
        keyHash,
        () => this.support.withRetry(() => this._processOutflowInner(dto, callerUserId, reportingClassOverride)),
      ) as Promise<Awaited<ReturnType<typeof this._processOutflowInner>>>;
    }
    return this.support.withRetry(async () => this._processOutflowInner(dto, callerUserId, reportingClassOverride));
  }

  private async _processOutflowInner(
    dto: OutflowDto,
    callerUserId?: string,
    reportingClassOverride?: LedgerReportingClass,
  ) {
    assertOperationNotesLength(dto.notes);
    const userId   = this.support.resolveUserId(callerUserId);
    const tenantId = this.support.resolveTenantId();
    const { entryDate, txDate } = this.support.buildDates(dto.transactionDate);

    return this.db.withTenant(async (tx) => {
      const invoiceNumber = dto.invoiceNumber || await generateInvoiceSerial(tx, dto.companyId, dto.kind, txDate);
      const { invoice, ledgerEntries } = await persistOutflowInvoiceWithLedger(
        tx,
        this.support,
        this.fiscalPeriod,
        { tenantId, userId, dto, entryDate, txDate, invoiceNumber, reportingClassOverride },
      );
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
    assertOutflowBatchNoDuplicateSupplierInvoiceKeys(dtos);
    const userId = this.support.resolveUserId(callerUserId);
    return this.db.withTenant(async (tx) => {
      return this.persistOutflowBatchInTransaction(tx, dtos, userId, tenantId);
    });
  }

  async processOutflowBatchInTransaction(
    tx: TxClient,
    dtos: OutflowDto[],
    callerUserId?: string,
    tenantId = this.support.resolveTenantId(),
  ) {
    assertOutflowBatchNoDuplicateSupplierInvoiceKeys(dtos);
    const userId = this.support.resolveUserId(callerUserId);
    return this.persistOutflowBatchInTransaction(tx, dtos, userId, tenantId);
  }

  private async persistOutflowBatchInTransaction(
    tx: TxClient,
    dtos: OutflowDto[],
    userId: string,
    tenantId: string,
  ) {
    const results = [];
    for (const dto of dtos) {
      assertOperationNotesLength(dto.notes);
      const { entryDate, txDate } = this.support.buildDates(dto.transactionDate);
      const serial = dto.invoiceNumber || await generateInvoiceSerial(tx, dto.companyId, dto.kind, txDate);
      const { invoice } = await persistOutflowInvoiceWithLedger(
        tx,
        this.support,
        this.fiscalPeriod,
        { tenantId, userId, dto, entryDate, txDate, invoiceNumber: serial },
      );
      results.push({ invoice, ledgerEntry: null });
    }
    return results;
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

    const txDateStr = toYmd(inv.transactionDate);
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
      select: { entryDate: true, debitAccountId: true, reportingClass: true },
    });
    const entryDate = first?.entryDate ?? inv.entryDate;
    const debitAccountId =
      ledgerOpts?.preserveDebitAccount === false
        ? await this.support.getDefaultExpenseAccount(tx, companyId, inv.kind)
        : first?.debitAccountId ??
          (await this.support.getDefaultExpenseAccount(tx, companyId, inv.kind));

    const referenceType =
      inv.kind === 'salary' ? 'salary' : inv.kind === 'advance' ? 'advance' : 'invoice';

    await replaceOutflowInvoiceLedgerAndAllocations(
      tx,
      companyId,
      inv,
      invoiceId,
      splits,
      debitAccountId,
      entryDate,
      referenceType,
      (first?.reportingClass as LedgerReportingClass | undefined) ?? reportingClassForOutflowKind(inv.kind),
      userId,
      (t, cid, vid) => this.support.getVaultAccount(t, cid, vid),
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
      splits = scaleVaultAllocationsToTotal(
        allocs.map((a) => ({
          vaultId: a.vaultId,
          amount:  new Prisma.Decimal(a.amount),
        })),
        newTotal,
      );
    } else if (allocs.length === 1) {
      splits = [{ vaultId: allocs[0].vaultId, amount: newTotal }];
    } else {
      const txDateStr = toYmd(inv.transactionDate);
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
      select: { entryDate: true, debitAccountId: true, reportingClass: true },
    });
    const entryDate = first?.entryDate ?? inv.entryDate;
    const debitAccountId =
      ledgerOpts?.preserveDebitAccount === false
        ? await this.support.getDefaultExpenseAccount(tx, companyId, inv.kind)
        : first?.debitAccountId ??
          (await this.support.getDefaultExpenseAccount(tx, companyId, inv.kind));

    const referenceType =
      inv.kind === 'salary' ? 'salary' : inv.kind === 'advance' ? 'advance' : 'invoice';

    await replaceOutflowInvoiceLedgerAndAllocations(
      tx,
      companyId,
      inv,
      invoiceId,
      splits,
      debitAccountId,
      entryDate,
      referenceType,
      (first?.reportingClass as LedgerReportingClass | undefined) ?? reportingClassForOutflowKind(inv.kind),
      userId,
      (t, cid, vid) => this.support.getVaultAccount(t, cid, vid),
    );
  }

  /**
   * مزامنة `transaction_date` على قيود دفتر الأستاذ النشطة المرتبطة بفاتورة صرف.
   * لا يغيّر مبالغاً — يُستدعى عند PATCH تاريخ الفاتورة فقط.
   */
  async syncActiveLedgerTransactionDateForOutflowInvoice(
    tx: TxClient,
    companyId: string,
    invoiceId: string,
    transactionDate: Date,
  ): Promise<void> {
    await tx.ledgerEntry.updateMany({
      where: {
        companyId,
        referenceId: invoiceId,
        referenceType: { in: ['invoice', 'salary', 'advance'] },
        status: 'active',
      },
      data: { transactionDate },
    });
  }

  // ══════════════════════════════════════════════════════════
}

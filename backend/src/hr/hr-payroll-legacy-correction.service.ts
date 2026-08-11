import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import {
  buildLegacyPayrollCorrectionPreview,
  type LegacyPayrollCorrectionCandidate,
  type LegacyPayrollCorrectionPreview,
} from './hr-payroll-legacy-correction-policy.util';
import type {
  PayrollLegacyCorrectionConfirmDto,
  PayrollLegacyCorrectionPreviewDto,
} from './dto/payroll-legacy-correction.dto';

type CorrectionProof = LegacyPayrollCorrectionPreview & {
  sourceRunId: string;
  sourceRunNumber: string;
  candidateCount: number;
  candidates: LegacyPayrollCorrectionCandidate[];
};

const DOCUMENTED_REPAIR_RE = /^\[(?:PAYROLL_COST_GAP_REPAIR_V2|PAYROLL_ADVANCE_RECONCILIATION)\]\s*run=([^,\s]+),\s*payrollItem=([^,\s]+)/;
const money = (value: Prisma.Decimal | number | string | null | undefined) =>
  Number(new Prisma.Decimal(value ?? 0).toDecimalPlaces(2));
const correctionAuditId = (companyId: string, idempotencyKey: string) =>
  `plc_${createHash('sha256').update(`${companyId}:${idempotencyKey}`).digest('hex')}`;
const monthRange = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return {
    from: new Date(Date.UTC(year, monthNumber - 1, 1)),
    to: new Date(Date.UTC(year, monthNumber, 1)),
  };
};
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matchesLegacyPayrollDeductionNote = (notes: string, runNumber: string, invoiceNumber: string) =>
  new RegExp(
    `^خصم سلفة تلقائي من مسير\\s+${escapeRegExp(runNumber)}\\s*-\\s*سلفة\\s+${escapeRegExp(invoiceNumber)}$`,
  ).test(notes.trim());

@Injectable()
export class HrPayrollLegacyCorrectionService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly accountingCore: AccountingCoreService,
  ) {}

  preview(companyId: string, dto: PayrollLegacyCorrectionPreviewDto) {
    return this.prisma.withTenant(async (tx) => {
      const transaction = tx as unknown as Prisma.TransactionClient;
      await this.lock(transaction, companyId, dto.targetMonth);
      return this.buildProof(transaction, companyId, dto);
    });
  }

  confirm(companyId: string, userId: string, dto: PayrollLegacyCorrectionConfirmDto) {
    return this.prisma.withTenant(async (tx) => {
      const transaction = tx as unknown as Prisma.TransactionClient;
      await this.lock(transaction, companyId, dto.targetMonth);
      const auditId = correctionAuditId(companyId, dto.idempotencyKey);
      const replay = await transaction.auditLog.findUnique({ where: { id: auditId } });
      if (replay) {
        const stored = (replay.newValue ?? {}) as Record<string, unknown>;
        if (stored.previewHash !== dto.previewHash) {
          throw new ConflictException('مفتاح منع التكرار مستخدم لتصحيح مختلف.');
        }
        return { ...stored, replayed: true };
      }

      const proof = await this.buildProof(transaction, companyId, dto);
      if (proof.previewHash !== dto.previewHash) {
        throw new ConflictException('تغيّرت بيانات المطابقة بعد المعاينة. أعد المعاينة قبل التأكيد.');
      }

      const cancelled = await this.accountingCore.cancelProvenPayrollLegacyLedgerRowsInTransaction(
        transaction,
        companyId,
        proof.ledgerEntryIds,
      );
      if (cancelled.count !== proof.ledgerEntryIds.length) {
        throw new ConflictException('تغيّرت إحدى القيود أثناء التصحيح؛ لم يتم حفظ أي تغيير.');
      }

      const afterLedgerTotal = await this.ledgerPayrollCost(transaction, companyId, dto.targetMonth);
      const afterDifference = money(afterLedgerTotal.minus(proof.expectedPayrollCost));
      if (Math.abs(afterDifference) > 0.02 || Math.abs(money(afterLedgerTotal) - proof.ledgerPayrollCostAfter) > 0.02) {
        throw new ConflictException('لم تحقق النتيجة المطابقة الصفرية؛ تم إلغاء العملية بالكامل.');
      }

      const company = await transaction.company.findUnique({ where: { id: companyId }, select: { tenantId: true } });
      if (!company) throw new NotFoundException('الشركة غير موجودة.');
      const result = {
        companyId,
        targetMonth: dto.targetMonth,
        sourceRunNumber: dto.sourceRunNumber,
        cancelledLedgerEntryIds: proof.ledgerEntryIds,
        cancelledCount: cancelled.count,
        cancelledTotal: proof.selectedLegacyTotal,
        ledgerPayrollCostBefore: proof.ledgerPayrollCostBefore,
        ledgerPayrollCostAfter: money(afterLedgerTotal),
        expectedPayrollCost: proof.expectedPayrollCost,
        differenceAfter: afterDifference,
        previewHash: proof.previewHash,
        idempotencyKey: dto.idempotencyKey,
        reason: dto.reason,
        replayed: false,
      };
      await transaction.auditLog.create({
        data: {
          id: auditId,
          tenantId: company.tenantId,
          companyId,
          userId,
          action: 'cancel',
          entity: 'payroll_legacy_duplicate_ledger_correction',
          entityId: `${dto.targetMonth}:${dto.sourceRunNumber}`,
          oldValue: {
            previewHash: proof.previewHash,
            rows: proof.candidates.map((row) => ({
              ledgerEntryId: row.ledgerEntryId,
              status: row.status,
              amount: row.amount,
              transactionDate: row.transactionDate.toISOString(),
              deductionId: row.deductionId,
              deductionNotes: row.deductionNotes,
              employeeId: row.employeeId,
              advanceInvoiceId: row.advanceInvoiceId,
              advanceInvoiceNumber: row.advanceInvoiceNumber,
              documentedRepairLedgerEntryId: row.documentedRepairLedgerEntryId,
              sourcePayrollItemId: row.sourcePayrollItemId,
            })),
          },
          newValue: result,
        },
      });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async lock(tx: Prisma.TransactionClient, companyId: string, targetMonth: string) {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${`payroll-legacy-correction:${companyId}:${targetMonth}`}))
    `;
  }

  private async buildProof(
    tx: Prisma.TransactionClient,
    companyId: string,
    dto: PayrollLegacyCorrectionPreviewDto,
  ): Promise<CorrectionProof> {
    const sourceRun = await tx.payrollRun.findFirst({
      where: { companyId, runNumber: dto.sourceRunNumber, status: 'completed' },
      include: { items: true },
    });
    if (!sourceRun) throw new NotFoundException('المسير المرجعي المكتمل غير موجود في الشركة.');
    const sourceItemByEmployee = new Map(sourceRun.items.map((item) => [item.employeeId, item]));
    if (sourceItemByEmployee.size !== sourceRun.items.length) {
      throw new BadRequestException('المسير المرجعي يحتوي تكراراً غير صالح للموظف.');
    }

    const { from, to } = monthRange(dto.targetMonth);
    // Derive the complete eligible pool server-side. The supplied IDs must be
    // exactly this set; an owner cannot accidentally submit only a convenient subset.
    const ledgerRows = await tx.ledgerEntry.findMany({
      where: {
        companyId,
        status: 'active',
        referenceType: 'advance_settlement',
        transactionDate: { gte: from, lt: to },
        vaultId: null,
        debitAccount: { code: 'EXP-004' },
        creditAccount: { code: 'ADV-001' },
        payrollAdvanceSettlements: { none: {} },
      },
      include: {
        debitAccount: { select: { code: true } },
        creditAccount: { select: { code: true } },
        payrollAdvanceSettlements: { select: { id: true } },
      },
    });
    const deductionIds = ledgerRows.map((row) => row.referenceId);
    if (new Set(deductionIds).size !== deductionIds.length) {
      throw new BadRequestException('يوجد أكثر من قيد يشير إلى نفس سجل الخصم؛ التصحيح مرفوض.');
    }
    const deductions = await tx.employeeDeduction.findMany({
      where: { companyId, id: { in: deductionIds }, deductionType: 'advance' },
    });
    const deductionById = new Map(deductions.map((row) => [row.id, row]));
    const advanceIds = deductions.map((row) => row.referenceId).filter((id): id is string => !!id);
    if (new Set(advanceIds).size !== advanceIds.length) throw new BadRequestException('ربط السلفة مكرر.');
    const advances = await tx.invoice.findMany({
      where: { companyId, id: { in: advanceIds }, kind: 'advance' },
      select: { id: true, employeeId: true, invoiceNumber: true },
    });
    const advanceById = new Map(advances.map((row) => [row.id, row]));
    const matchedRows = ledgerRows.filter((ledger) => {
      const deduction = deductionById.get(ledger.referenceId);
      const advance = deduction?.referenceId ? advanceById.get(deduction.referenceId) : undefined;
      return !!(
        ledger.employeeId && deduction && advance && sourceItemByEmployee.has(ledger.employeeId)
        && deduction.employeeId === ledger.employeeId && advance.employeeId === ledger.employeeId
        && matchesLegacyPayrollDeductionNote(String(deduction.notes ?? ''), dto.sourceRunNumber, advance.invoiceNumber)
      );
    });
    const selectedEmployeeIds = [...new Set(matchedRows.map((row) => row.employeeId as string))];
    if (!matchedRows.length) throw new BadRequestException('لم يجد النظام قيوداً قديمة تطابق المسير والسلف المحددة حرفياً.');

    const repairDeductions = await tx.employeeDeduction.findMany({
      where: {
        companyId,
        employeeId: { in: selectedEmployeeIds },
        deductionType: 'advance',
        OR: [
          { notes: { startsWith: `[PAYROLL_COST_GAP_REPAIR_V2] run=${dto.sourceRunNumber}, payrollItem=` } },
          { notes: { startsWith: `[PAYROLL_ADVANCE_RECONCILIATION] run=${dto.sourceRunNumber}, payrollItem=` } },
        ],
      },
    });
    const repairLedgers = repairDeductions.length ? await tx.ledgerEntry.findMany({
      where: {
        companyId,
        referenceType: 'advance_settlement',
        referenceId: { in: repairDeductions.map((row) => row.id) },
        status: 'active',
      },
      include: { debitAccount: { select: { code: true } }, creditAccount: { select: { code: true } } },
    }) : [];
    const repairByEmployee = new Map<string, {
      ledgerId: string;
      deductionId: string;
      amount: number;
      payrollItemId: string;
    }>();
    for (const deduction of repairDeductions) {
      const match = String(deduction.notes ?? '').match(DOCUMENTED_REPAIR_RE);
      const item = match?.[1] === dto.sourceRunNumber ? sourceRun.items.find((row) => row.id === match[2]) : null;
      const ledgerMatches = repairLedgers.filter((row) => row.referenceId === deduction.id);
      if (!item || item.employeeId !== deduction.employeeId || ledgerMatches.length !== 1) continue;
      const repairLedger = ledgerMatches[0];
      if (
        repairLedger.employeeId !== deduction.employeeId
        || repairLedger.debitAccount.code !== 'EXP-004'
        || repairLedger.creditAccount.code !== 'ADV-001'
        || repairLedger.vaultId
        || money(repairLedger.amount) !== money(deduction.amount)
      ) continue;
      if (repairByEmployee.has(deduction.employeeId)) {
        throw new BadRequestException('وجد النظام أكثر من مجموعة إصلاح موثقة للموظف نفسه.');
      }
      repairByEmployee.set(deduction.employeeId, {
        ledgerId: repairLedger.id,
        deductionId: deduction.id,
        amount: money(repairLedger.amount),
        payrollItemId: item.id,
      });
    }
    if (selectedEmployeeIds.some((employeeId) => !repairByEmployee.has(employeeId))) {
      throw new BadRequestException('لا توجد مطابقة إصلاح موثقة وفريدة لكل موظف محدد.');
    }

    const candidates = matchedRows.map((ledger): LegacyPayrollCorrectionCandidate => {
      const deduction = deductionById.get(ledger.referenceId)!;
      const advance = deduction.referenceId ? advanceById.get(deduction.referenceId) : undefined;
      const sourceItem = ledger.employeeId ? sourceItemByEmployee.get(ledger.employeeId) : undefined;
      const repair = ledger.employeeId ? repairByEmployee.get(ledger.employeeId) : undefined;
      if (
        !advance || !sourceItem || !repair
        || deduction.employeeId !== ledger.employeeId
        || advance.employeeId !== ledger.employeeId
      ) throw new BadRequestException('فشل تطابق الموظف بين القيد والخصم والسلفة والمسير.');
      const notes = String(deduction.notes ?? '');
      return {
        ledgerEntryId: ledger.id,
        deductionId: deduction.id,
        deductionNotes: notes,
        employeeId: ledger.employeeId!,
        advanceInvoiceId: advance.id,
        advanceInvoiceNumber: advance.invoiceNumber,
        sourceRunId: sourceRun.id,
        sourceRunNumber: sourceRun.runNumber,
        sourcePayrollItemId: sourceItem.id,
        documentedRepairLedgerEntryId: repair.ledgerId,
        documentedRepairDeductionId: repair.deductionId,
        documentedRepairAmount: repair.amount,
        transactionDate: ledger.transactionDate,
        amount: money(ledger.amount),
        status: ledger.status,
        referenceType: ledger.referenceType,
        debitAccountCode: ledger.debitAccount.code,
        creditAccountCode: ledger.creditAccount.code,
        vaultId: ledger.vaultId,
        structuredSettlementId: ledger.payrollAdvanceSettlements[0]?.id ?? null,
        documentedHistoricalRepair: DOCUMENTED_REPAIR_RE.test(notes),
      };
    });

    const suppliedIds = [...dto.ledgerEntryIds].sort();
    const derivedIds = candidates.map((row) => row.ledgerEntryId).sort();
    if (suppliedIds.length !== derivedIds.length || suppliedIds.some((id, index) => id !== derivedIds[index])) {
      throw new BadRequestException('قائمة القيود لا تطابق كامل مجموعة التكرار المؤهلة التي اشتقها الخادم.');
    }

    const expectedPayrollCost = await this.expectedPayrollCost(tx, companyId, dto.targetMonth);
    const ledgerPayrollCost = await this.ledgerPayrollCost(tx, companyId, dto.targetMonth);
    try {
      const preview = buildLegacyPayrollCorrectionPreview({
        companyId,
        targetMonth: dto.targetMonth,
        sourceRunNumber: dto.sourceRunNumber,
        expectedPayrollCost: money(expectedPayrollCost),
        ledgerPayrollCost: money(ledgerPayrollCost),
        candidates,
      });
      return {
        ...preview,
        sourceRunId: sourceRun.id,
        sourceRunNumber: sourceRun.runNumber,
        candidateCount: candidates.length,
        candidates,
      };
    } catch (error) {
      throw new BadRequestException(`فشل تحقق التصحيح الآمن: ${error instanceof Error ? error.message : 'UNKNOWN'}`);
    }
  }

  private async expectedPayrollCost(tx: Prisma.TransactionClient, companyId: string, month: string) {
    const { from, to } = monthRange(month);
    const runs = await tx.payrollRun.findMany({
      where: { companyId, status: 'completed', payrollMonth: { gte: from, lt: to } },
      include: { items: { select: { advancesDeduct: true } } },
    });
    return runs.reduce(
      (sum, run) => sum.plus(run.totalAmount).plus(run.items.reduce(
        (itemSum, item) => itemSum.plus(item.advancesDeduct ?? 0),
        new Prisma.Decimal(0),
      )),
      new Prisma.Decimal(0),
    );
  }

  private async ledgerPayrollCost(tx: Prisma.TransactionClient, companyId: string, month: string) {
    const { from, to } = monthRange(month);
    const salaryAccount = await tx.account.findFirst({
      where: { companyId, code: 'EXP-004', type: 'expense' },
      select: { id: true },
    });
    if (!salaryAccount) throw new BadRequestException('حساب الرواتب EXP-004 غير موجود.');
    const aggregate = await tx.ledgerEntry.aggregate({
      where: {
        companyId,
        debitAccountId: salaryAccount.id,
        status: 'active',
        transactionDate: { gte: from, lt: to },
      },
      _sum: { amount: true },
    });
    return new Prisma.Decimal(aggregate._sum.amount ?? 0);
  }
}

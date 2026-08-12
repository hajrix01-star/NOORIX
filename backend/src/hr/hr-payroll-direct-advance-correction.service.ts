import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { AccountingCoreService } from '../accounting-core/accounting-core.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type {
  PayrollDirectAdvanceCorrectionConfirmDto,
  PayrollLegacyCorrectionPreviewDto,
} from './dto/payroll-legacy-correction.dto';
import {
  buildDirectAdvancePayrollDuplicatePreview,
  type DirectAdvancePayrollDuplicateCandidate,
  type DirectAdvancePayrollDuplicatePreview,
} from './hr-payroll-direct-advance-correction-policy.util';

type Proof = DirectAdvancePayrollDuplicatePreview & {
  sourceRunId: string;
  sourceRunNumber: string;
  candidateCount: number;
  candidates: DirectAdvancePayrollDuplicateCandidate[];
};

const money = (value: Prisma.Decimal | number | string | null | undefined) =>
  Number(new Prisma.Decimal(value ?? 0).toDecimalPlaces(2));
const monthRange = (month: string) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return { from: new Date(Date.UTC(year, monthNumber - 1, 1)), to: new Date(Date.UTC(year, monthNumber, 1)) };
};
const advancePayrollRun = (notes: string) => {
  const match = notes.match(/(?:^|\r?\n)\[ADV_PAYROLL\]\s*run=([^,\s]+),\s*amount=([0-9]+(?:\.[0-9]{1,2})?),\s*date=\d{4}-\d{2}-\d{2}\s*$/);
  return match ? { runNumber: match[1], amount: Number(match[2]) } : null;
};

@Injectable()
export class HrPayrollDirectAdvanceCorrectionService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly accountingCore: AccountingCoreService,
  ) {}

  preview(companyId: string, dto: PayrollLegacyCorrectionPreviewDto) {
    return this.prisma.withTenant(async (tx) => {
      const transaction = tx as unknown as Prisma.TransactionClient;
      await this.lock(transaction, companyId, dto.targetMonth);
      return this.buildProof(transaction, companyId, dto);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  confirm(companyId: string, userId: string, dto: PayrollDirectAdvanceCorrectionConfirmDto) {
    return this.prisma.withTenant(async (tx) => {
      const transaction = tx as unknown as Prisma.TransactionClient;
      await this.lock(transaction, companyId, dto.targetMonth);
      const auditId = `pdac_${createHash('sha256').update(`${companyId}:${dto.idempotencyKey}`).digest('hex')}`;
      const replay = await transaction.auditLog.findUnique({ where: { id: auditId } });
      if (replay) {
        const stored = (replay.newValue ?? {}) as Record<string, unknown>;
        if (stored.previewHash !== dto.previewHash) throw new ConflictException('مفتاح منع التكرار مستخدم لتصحيح مختلف.');
        return { ...stored, replayed: true };
      }

      const proof = await this.buildProof(transaction, companyId, dto);
      if (proof.previewHash !== dto.previewHash) throw new ConflictException('تغيرت بيانات المطابقة بعد المعاينة؛ أعد المعاينة قبل التأكيد.');
      const cancelled = await this.accountingCore.cancelProvenDirectAdvancePayrollDuplicateLedgerRowsInTransaction(
        transaction, companyId, proof.ledgerEntryIds,
      );
      if (cancelled.count !== proof.ledgerEntryIds.length) throw new ConflictException('تغير أحد القيود أثناء التصحيح؛ لم يحفظ أي تغيير.');

      const afterLedgerTotal = await this.ledgerPayrollCost(transaction, companyId, dto.targetMonth);
      const afterDifference = money(afterLedgerTotal.minus(proof.expectedPayrollCost));
      if (Math.abs(afterDifference) > 0.02 || Math.abs(money(afterLedgerTotal) - proof.ledgerPayrollCostAfter) > 0.02) {
        throw new ConflictException('لم تتحقق المطابقة الصفرية؛ ألغيت العملية بالكامل.');
      }
      const company = await transaction.company.findUnique({ where: { id: companyId }, select: { tenantId: true } });
      if (!company) throw new NotFoundException('الشركة غير موجودة.');
      const result = {
        companyId,
        correctionMode: proof.correctionMode,
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
          id: auditId, tenantId: company.tenantId, companyId, userId,
          action: 'cancel', entity: 'payroll_direct_advance_duplicate_ledger_correction',
          entityId: `${dto.targetMonth}:${dto.sourceRunNumber}`,
          oldValue: { previewHash: proof.previewHash, rows: proof.candidates },
          newValue: result,
        },
      });
      return result;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async buildProof(
    tx: Prisma.TransactionClient,
    companyId: string,
    dto: PayrollLegacyCorrectionPreviewDto,
  ): Promise<Proof> {
    const sourceRun = await tx.payrollRun.findFirst({
      where: { companyId, runNumber: dto.sourceRunNumber, status: 'completed' }, include: { items: true },
    });
    if (!sourceRun) throw new NotFoundException('المسير المرجعي المكتمل غير موجود في الشركة.');
    const { from, to } = monthRange(dto.targetMonth);
    if (sourceRun.payrollMonth < from || sourceRun.payrollMonth >= to) {
      throw new BadRequestException('المسير المرجعي خارج شهر التصحيح.');
    }
    const rows = await tx.ledgerEntry.findMany({
      where: {
        companyId, status: 'active', referenceType: 'invoice', transactionDate: { gte: from, lt: to }, vaultId: null,
        debitAccount: { code: 'EXP-004' }, creditAccount: { code: 'ADV-001' },
      },
      include: { debitAccount: { select: { code: true } }, creditAccount: { select: { code: true } } },
    });
    const invoices = await tx.invoice.findMany({
      where: { companyId, id: { in: rows.map((row) => row.referenceId) }, kind: 'advance', status: 'active' },
      select: { id: true, employeeId: true, invoiceNumber: true, totalAmount: true, notes: true },
    });
    const invoiceById = new Map(invoices.map((row) => [row.id, row]));
    const itemByEmployee = new Map(sourceRun.items.map((item) => [item.employeeId, item]));
    const candidates = rows.flatMap((row): DirectAdvancePayrollDuplicateCandidate[] => {
      const advance = invoiceById.get(row.referenceId);
      const tagged = advance ? advancePayrollRun(String(advance.notes ?? '')) : null;
      const item = advance?.employeeId ? itemByEmployee.get(advance.employeeId) : undefined;
      if (!advance || !tagged || tagged.runNumber !== sourceRun.runNumber || !item || !advance.employeeId) return [];
      if (row.employeeId && row.employeeId !== advance.employeeId) return [];
      return [{
        ledgerEntryId: row.id, advanceInvoiceId: advance.id, advanceInvoiceNumber: advance.invoiceNumber,
        employeeId: advance.employeeId, sourceRunId: sourceRun.id, sourceRunNumber: sourceRun.runNumber,
        sourcePayrollItemId: item.id, invoiceAmount: money(advance.totalAmount),
        payrollItemAdvanceDeduct: money(item.advancesDeduct), transactionDate: row.transactionDate,
        amount: money(row.amount), status: row.status, referenceType: row.referenceType,
        debitAccountCode: row.debitAccount.code, creditAccountCode: row.creditAccount.code, vaultId: row.vaultId,
      }];
    });
    const suppliedIds = [...dto.ledgerEntryIds].sort();
    const derivedIds = candidates.map((row) => row.ledgerEntryId).sort();
    if (!derivedIds.length || suppliedIds.length !== derivedIds.length || suppliedIds.some((id, index) => id !== derivedIds[index])) {
      throw new BadRequestException('قائمة القيود لا تطابق كامل القيود المثبتة آلياً.');
    }
    const expectedPayrollCost = await this.expectedPayrollCost(tx, companyId, dto.targetMonth);
    const ledgerPayrollCost = await this.ledgerPayrollCost(tx, companyId, dto.targetMonth);
    try {
      const preview = buildDirectAdvancePayrollDuplicatePreview({
        companyId, targetMonth: dto.targetMonth, sourceRunNumber: sourceRun.runNumber,
        expectedPayrollCost: money(expectedPayrollCost), ledgerPayrollCost: money(ledgerPayrollCost), candidates,
      });
      return { ...preview, sourceRunId: sourceRun.id, sourceRunNumber: sourceRun.runNumber, candidateCount: candidates.length, candidates };
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
    const runIds = runs.map((run) => run.id);
    const [standaloneSalaries, partTimeLinks] = await Promise.all([
      tx.invoice.aggregate({
        where: { companyId, kind: 'salary', status: 'active', transactionDate: { gte: from, lt: to }, batchId: { notIn: runIds } },
        _sum: { totalAmount: true },
      }),
      tx.historicalPartTimePayrollLink.findMany({
        where: { companyId, status: 'active', payrollMonth: { gte: from, lt: to }, ledgerEntry: { status: 'active' } },
        include: { ledgerEntry: { select: { amount: true } } },
      }),
    ]);
    return runs.reduce((sum, run) => sum.plus(run.totalAmount).plus(run.items.reduce(
      (itemSum, item) => itemSum.plus(item.advancesDeduct ?? 0), new Prisma.Decimal(0),
    )), new Prisma.Decimal(0)).plus(standaloneSalaries._sum.totalAmount ?? 0).plus(
      partTimeLinks.reduce((sum, row) => sum.plus(row.ledgerEntry.amount), new Prisma.Decimal(0)),
    );
  }

  private async ledgerPayrollCost(tx: Prisma.TransactionClient, companyId: string, month: string) {
    const { from, to } = monthRange(month);
    const salaryAccount = await tx.account.findFirst({ where: { companyId, code: 'EXP-004', type: 'expense' }, select: { id: true } });
    if (!salaryAccount) throw new BadRequestException('حساب الرواتب EXP-004 غير موجود.');
    const aggregate = await tx.ledgerEntry.aggregate({
      where: { companyId, debitAccountId: salaryAccount.id, status: 'active', transactionDate: { gte: from, lt: to } },
      _sum: { amount: true },
    });
    return new Prisma.Decimal(aggregate._sum.amount ?? 0);
  }

  private async lock(tx: Prisma.TransactionClient, companyId: string, targetMonth: string) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`payroll-direct-advance-correction:${companyId}:${targetMonth}`}))`;
  }
}

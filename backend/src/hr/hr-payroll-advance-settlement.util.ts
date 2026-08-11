import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { getHrAdvanceBalanceParts } from './hr-advance-balance.util';
import { reportingClassForReferenceType } from '../financial-core/financial-reporting-classification.util';

type ApplyAdvanceSettlementDb = {
  invoice: Pick<TenantPrismaService['invoice'], 'findMany' | 'update'>;
  employeeDeduction: Pick<TenantPrismaService['employeeDeduction'], 'create'>;
  account: Pick<TenantPrismaService['account'], 'findFirst'>;
  ledgerEntry: Pick<TenantPrismaService['ledgerEntry'], 'create'>;
  payrollAdvanceSettlement: Pick<TenantPrismaService['payrollAdvanceSettlement'], 'create'>;
};

type ReverseAdvanceSettlementDb = {
  invoice: Pick<TenantPrismaService['invoice'], 'findFirst' | 'update'>;
  employeeDeduction: Pick<TenantPrismaService['employeeDeduction'], 'findMany' | 'deleteMany'>;
  ledgerEntry: Pick<TenantPrismaService['ledgerEntry'], 'updateMany'>;
  payrollAdvanceSettlement: Pick<TenantPrismaService['payrollAdvanceSettlement'], 'updateMany'>;
};

export function parseAdvanceDeferMonth(notes?: string | null): string {
  const m = String(notes || '').match(/\[ADV_DEFER\]\s*(\d{4}-\d{2})/);
  return m ? m[1] : '';
}

/**
 * تخصيم السلف من فواتير السلف وربطها بالمسيرة (نفس منطق صرف المسيرة).
 * يُستدعى عند اعتماد المسيرة أو عند الصرف إن لم تُطبَّق من قبل.
 */
export async function applyPayrollAdvanceSettlements(
  db: ApplyAdvanceSettlementDb,
  run: {
    id: string;
    companyId: string;
    runNumber: string;
    payrollMonth: Date;
    items: Array<{
      id: string;
      employeeId: string;
      advancesDeduct: Prisma.Decimal | null;
      advanceSelections?: Prisma.JsonValue | null;
      employee: { name: string | null } | null;
    }>;
  },
  txDate: string,
  tenantId: string,
  options: { postExpenseLedger?: boolean } = {},
): Promise<Prisma.Decimal> {
  let allocatedTotal = new Prisma.Decimal(0);
  const runMonth = `${run.payrollMonth.getFullYear()}-${String(run.payrollMonth.getMonth() + 1).padStart(2, '0')}`;
  let settlementAccounts: { salaryExpenseId: string; advanceAssetId: string } | null = null;

  const resolveSettlementAccounts = async () => {
    if (settlementAccounts) return settlementAccounts;
    const [salaryExpense, advanceAsset] = await Promise.all([
      db.account.findFirst({ where: { companyId: run.companyId, code: 'EXP-004', type: 'expense', isActive: true }, select: { id: true } }),
      db.account.findFirst({ where: { companyId: run.companyId, code: 'ADV-001', type: 'asset', isActive: true }, select: { id: true } }),
    ]);
    if (!salaryExpense || !advanceAsset) {
      throw new BadRequestException('حساب الرواتب أو حساب سلف الموظفين غير مهيأ لهذه الشركة.');
    }
    settlementAccounts = { salaryExpenseId: salaryExpense.id, advanceAssetId: advanceAsset.id };
    return settlementAccounts;
  };

  for (const item of run.items) {
    let remainingToDeduct = Number(item.advancesDeduct ?? 0);
    if (remainingToDeduct <= 0) continue;

    const explicitSelections = Array.isArray(item.advanceSelections)
      ? item.advanceSelections
          .map((value) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
            const row = value as Prisma.JsonObject;
            const advanceId = typeof row.advanceId === 'string' ? row.advanceId : '';
            const amount = Number(row.amount);
            return advanceId && Number.isFinite(amount) && amount > 0 ? { advanceId, amount } : null;
          })
          .filter((value): value is { advanceId: string; amount: number } => !!value)
      : null;

    const advances = await db.invoice.findMany({
      where: {
        companyId: run.companyId,
        employeeId: item.employeeId,
        kind: 'advance',
        status: 'active',
        ...(explicitSelections ? { id: { in: explicitSelections.map((row) => row.advanceId) } } : {}),
      },
      orderBy: { transactionDate: 'asc' },
    });

    const orderedAdvances = explicitSelections
      ? explicitSelections.map((selection) => ({
          selection,
          advance: advances.find((advance) => advance.id === selection.advanceId),
        }))
      : advances.map((advance) => ({ selection: null, advance }));

    for (const row of orderedAdvances) {
      if (remainingToDeduct <= 0) break;
      const adv = row.advance;
      if (!adv) {
        throw new BadRequestException('إحدى السلف المحددة لم تعد متاحة. حدّث المسير وحاول مجددًا.');
      }
      const advanceMonth = adv.transactionDate
        ? `${adv.transactionDate.getFullYear()}-${String(adv.transactionDate.getMonth() + 1).padStart(2, '0')}`
        : '';
      if (advanceMonth > runMonth) {
        if (explicitSelections) {
          throw new BadRequestException(`السلفة ${adv.invoiceNumber} تاريخها بعد شهر المسير المحدد.`);
        }
        continue;
      }
      const deferMonth = parseAdvanceDeferMonth(adv.notes);
      if (deferMonth && deferMonth > runMonth) {
        if (explicitSelections) {
          throw new BadRequestException(`السلفة ${adv.invoiceNumber} مؤجلة إلى شهر لاحق.`);
        }
        continue;
      }

      const { remainingAmount: remaining, settledAmount: settled } = getHrAdvanceBalanceParts(adv);
      if (remaining <= 0) continue;

      // الاختيار الصريح هو مبلغ هذا المسير فقط؛ لا يغيّر القسط المركزي للسلفة.
      // المسيرات القديمة التي لا تملك اختيارات صريحة تستمر على منطق القسط السابق.
      const cap = row.selection
        ? remaining
        : adv.installmentAmount
          ? Math.min(Number(adv.installmentAmount), remaining)
          : remaining;
      const requested = row.selection?.amount ?? remainingToDeduct;
      if (row.selection && requested - remaining > 0.01) {
        throw new BadRequestException(
          `قيمة خصم السلفة ${adv.invoiceNumber} تتجاوز رصيدها الحالي. عدّل المسير قبل اعتماده.`,
        );
      }
      const allocate = Math.min(remainingToDeduct, requested, cap);
      const newSettled = settled + allocate;
      const settleNote = `${adv.notes || ''}\n[ADV_PAYROLL] run=${run.runNumber}, amount=${allocate}, date=${txDate}`.trim();

      await db.invoice.update({
        where: { id: adv.id },
        data: {
          settledAmount: new Prisma.Decimal(newSettled),
          settledAt: new Date(`${txDate}T00:00:00.000Z`),
          notes: settleNote,
        },
      });

      const deduction = await db.employeeDeduction.create({
        data: {
          tenantId,
          companyId: run.companyId,
          employeeId: item.employeeId,
          deductionType: 'advance',
          amount: new Prisma.Decimal(allocate),
          transactionDate: new Date(`${txDate}T00:00:00.000Z`),
          notes: `خصم سلفة تلقائي من مسير ${run.runNumber} - سلفة ${adv.invoiceNumber}`,
          referenceId: adv.id,
        },
      });

      // السلفة صُرفت سابقاً كأصل؛ هذه التسوية فقط تنقل الجزء المخصوم إلى تكلفة الرواتب
      // من دون حركة نقدية ثانية.
      let ledgerEntryId: string | null = null;
      if (options.postExpenseLedger !== false) {
        const accounts = await resolveSettlementAccounts();
        const settlementDate = new Date(`${txDate}T00:00:00.000Z`);
        const ledgerEntry = await db.ledgerEntry.create({
          data: {
            tenantId,
            companyId: run.companyId,
            debitAccountId: accounts.salaryExpenseId,
            creditAccountId: accounts.advanceAssetId,
            amount: new Prisma.Decimal(allocate),
            transactionDate: settlementDate,
            entryDate: settlementDate,
            referenceType: 'advance_settlement',
            referenceId: deduction.id,
            reportingClass: reportingClassForReferenceType('advance_settlement'),
            employeeId: item.employeeId,
            status: 'active',
          },
        });
        ledgerEntryId = ledgerEntry.id;
      }

      // This register is the authoritative future link. It does not post any
      // accounting entry; the payroll accrual already carries the full cost.
      await db.payrollAdvanceSettlement.create({
          data: {
            tenantId,
            companyId: run.companyId,
            payrollRunId: run.id,
            payrollRunItemId: item.id,
            advanceInvoiceId: adv.id,
            employeeId: item.employeeId,
            deductionId: deduction.id,
            ledgerEntryId,
            amount: new Prisma.Decimal(allocate),
            settlementDate: new Date(`${txDate}T00:00:00.000Z`),
            status: 'active',
            origin: 'payroll',
            idempotencyKey: `${run.id}:${item.id}:${adv.id}`,
            notes: `Payroll ${run.runNumber}; advance ${adv.invoiceNumber}`,
          },
      });
      remainingToDeduct -= allocate;
      allocatedTotal = allocatedTotal.plus(allocate);
    }

    if (explicitSelections && remainingToDeduct > 0.01) {
      throw new BadRequestException('تعذر تطبيق كامل خصم السلف المحدد. حدّث المسير وحاول مجددًا.');
    }
  }
  return allocatedTotal;
}

/**
 * عكس تسويات السلف المرتبطة بمسيرة (قبل حذف سجل المسيرة).
 * يطابق منطق prisma/delete-payroll-run-company-month.js
 */
export async function reversePayrollAdvanceSettlementsForDelete(
  db: ReverseAdvanceSettlementDb,
  companyId: string,
  runNumber: string,
): Promise<void> {
  await db.payrollAdvanceSettlement.updateMany({
    where: { companyId, payrollRun: { runNumber }, status: 'active' },
    data: { status: 'reversed', reversedAt: new Date() },
  });
  const deductionWhere: Prisma.EmployeeDeductionWhereInput = {
    companyId,
    deductionType: 'advance',
    OR: [
      { notes: { contains: `مسير ${runNumber}` } },
      { notes: { contains: `[PAYROLL_ADVANCE_RECONCILIATION] run=${runNumber},` } },
    ],
  };
  const deductions = await db.employeeDeduction.findMany({
    where: deductionWhere,
  });

  if (deductions.length) {
    await db.ledgerEntry.updateMany({
      where: {
        companyId,
        referenceType: 'advance_settlement',
        referenceId: { in: deductions.map((deduction) => deduction.id) },
        status: 'active',
      },
      data: { status: 'cancelled' },
    });
  }

  const esc = runNumber.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const advLineRe = new RegExp(`^\\[ADV_PAYROLL\\] run=${esc},`);

  for (const d of deductions) {
    if (!d.referenceId) continue;
    const inv = await db.invoice.findFirst({
      where: { id: d.referenceId, companyId, kind: 'advance' },
    });
    if (!inv) continue;

    const { totalAmount: total, settledAmount: prevSettled } = getHrAdvanceBalanceParts(inv);
    const deductAmt = Number(d.amount);
    const newSettled = Math.max(0, prevSettled - deductAmt);
    const newNotes = String(inv.notes || '')
      .split('\n')
      .filter((line) => !advLineRe.test(line.trim()))
      .join('\n')
      .trim();

    const eps = 0.02;
    await db.invoice.update({
      where: { id: inv.id },
      data: {
        settledAmount: new Prisma.Decimal(newSettled),
        settledAt: newSettled >= total - eps ? inv.settledAt : null,
        notes: newNotes || null,
      },
    });
  }

  if (deductions.length) {
    await db.employeeDeduction.deleteMany({
      where: deductionWhere,
    });
  }
}

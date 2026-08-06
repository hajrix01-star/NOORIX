import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { getHrAdvanceBalanceParts } from './hr-advance-balance.util';

type ApplyAdvanceSettlementDb = {
  invoice: Pick<TenantPrismaService['invoice'], 'findMany' | 'update'>;
  employeeDeduction: Pick<TenantPrismaService['employeeDeduction'], 'create'>;
};

type ReverseAdvanceSettlementDb = {
  invoice: Pick<TenantPrismaService['invoice'], 'findFirst' | 'update'>;
  employeeDeduction: Pick<TenantPrismaService['employeeDeduction'], 'findMany' | 'deleteMany'>;
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
    companyId: string;
    runNumber: string;
    payrollMonth: Date;
    items: Array<{
      employeeId: string;
      advancesDeduct: Prisma.Decimal | null;
      advanceSelections?: Prisma.JsonValue | null;
      employee: { name: string | null } | null;
    }>;
  },
  txDate: string,
  tenantId: string,
): Promise<void> {
  const runMonth = `${run.payrollMonth.getFullYear()}-${String(run.payrollMonth.getMonth() + 1).padStart(2, '0')}`;

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

      await db.employeeDeduction.create({
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

      remainingToDeduct -= allocate;
    }

    if (explicitSelections && remainingToDeduct > 0.01) {
      throw new BadRequestException('تعذر تطبيق كامل خصم السلف المحدد. حدّث المسير وحاول مجددًا.');
    }
  }
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
  const deductions = await db.employeeDeduction.findMany({
    where: {
      companyId,
      deductionType: 'advance',
      notes: { contains: `مسير ${runNumber}` },
    },
  });

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
      where: {
        companyId,
        deductionType: 'advance',
        notes: { contains: `مسير ${runNumber}` },
      },
    });
  }
}

import { Prisma } from '@prisma/client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

type AdvanceSettlementDb = Pick<TenantPrismaService, 'invoice' | 'employeeDeduction'>;

export function parseAdvanceDeferMonth(notes?: string | null): string {
  const m = String(notes || '').match(/\[ADV_DEFER\]\s*(\d{4}-\d{2})/);
  return m ? m[1] : '';
}

/**
 * تخصيم السلف من فواتير السلف وربطها بالمسيرة (نفس منطق صرف المسيرة).
 * يُستدعى عند اعتماد المسيرة أو عند الصرف إن لم تُطبَّق من قبل.
 */
export async function applyPayrollAdvanceSettlements(
  db: AdvanceSettlementDb,
  run: {
    companyId: string;
    runNumber: string;
    payrollMonth: Date;
    items: Array<{
      employeeId: string;
      advancesDeduct: Prisma.Decimal | null;
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

    const advances = await db.invoice.findMany({
      where: {
        companyId: run.companyId,
        employeeId: item.employeeId,
        kind: 'advance',
        status: 'active',
      },
      orderBy: { transactionDate: 'asc' },
    });

    for (const adv of advances) {
      if (remainingToDeduct <= 0) break;
      const deferMonth = parseAdvanceDeferMonth(adv.notes);
      if (deferMonth && deferMonth > runMonth) continue;

      const total = Number(adv.totalAmount ?? 0);
      const settled = Number(adv.settledAmount ?? 0);
      const remaining = Math.max(0, total - settled);
      if (remaining <= 0) continue;

      // إن كانت السلفة بأقساط محددة، اقتطع القسط فقط — لا الرصيد الكامل
      const cap = adv.installmentAmount
        ? Math.min(Number(adv.installmentAmount), remaining)
        : remaining;
      const allocate = Math.min(remainingToDeduct, cap);
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
  }
}

/**
 * عكس تسويات السلف المرتبطة بمسيرة (قبل حذف سجل المسيرة).
 * يطابق منطق prisma/delete-payroll-run-company-month.js
 */
export async function reversePayrollAdvanceSettlementsForDelete(
  db: AdvanceSettlementDb,
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

    const prevSettled = Number(inv.settledAmount ?? 0);
    const deductAmt = Number(d.amount);
    const newSettled = Math.max(0, prevSettled - deductAmt);
    const total = Number(inv.totalAmount ?? 0);
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

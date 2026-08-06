import { BadRequestException } from '@nestjs/common';
import type { TenantPrismaService } from '../prisma/tenant-prisma.service';
import type { PayrollRunItemDto } from './dto/create-payroll-run.dto';
import { getHrAdvanceBalanceParts } from './hr-advance-balance.util';
import { parseAdvanceDeferMonth } from './hr-payroll-advance-settlement.util';

type AdvanceSelectionDb = {
  invoice: Pick<TenantPrismaService['invoice'], 'findMany'>;
};

const MONEY_EPSILON = 0.01;

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Treats advance selections as authoritative payroll input. This prevents a client from
 * selecting another employee's advance, exceeding its live balance, or deducting the same
 * advance twice in one run. The selected amount belongs to this run only and never mutates
 * the advance's central installment. Undefined keeps backward compatibility for old drafts.
 */
export async function assertPayrollAdvanceSelections(
  db: AdvanceSelectionDb,
  companyId: string,
  payrollMonth: Date,
  items: PayrollRunItemDto[],
): Promise<void> {
  const explicitItems = items.filter((item) => item.advanceSelections !== undefined);
  if (!explicitItems.length) return;

  const allSelections = explicitItems.flatMap((item) =>
    (item.advanceSelections ?? []).map((selection) => ({ ...selection, employeeId: item.employeeId })),
  );
  const advanceIds = allSelections.map((selection) => selection.advanceId);
  if (new Set(advanceIds).size !== advanceIds.length) {
    throw new BadRequestException('لا يمكن اختيار السلفة نفسها أكثر من مرة في المسير.');
  }

  const advances = advanceIds.length
    ? await db.invoice.findMany({
        where: {
          id: { in: advanceIds },
          companyId,
          kind: 'advance',
          status: 'active',
        },
      })
    : [];
  const byId = new Map(advances.map((advance) => [advance.id, advance]));
  const runMonth = monthKey(payrollMonth);

  for (const item of explicitItems) {
    let selectedTotal = 0;
    for (const selection of item.advanceSelections ?? []) {
      const advance = byId.get(selection.advanceId);
      if (!advance || advance.employeeId !== item.employeeId) {
        throw new BadRequestException('إحدى السلف المحددة غير متاحة لهذا الموظف. حدّث المسير وحاول مجددًا.');
      }
      const deferMonth = parseAdvanceDeferMonth(advance.notes);
      if (deferMonth && deferMonth > runMonth) {
        throw new BadRequestException(`السلفة ${advance.invoiceNumber} مؤجلة إلى شهر لاحق.`);
      }
      const { remainingAmount } = getHrAdvanceBalanceParts(advance);
      if (remainingAmount <= 0) {
        throw new BadRequestException(`السلفة ${advance.invoiceNumber} مسددة بالفعل.`);
      }
      const selectedAmount = Number(selection.amount);
      if (!Number.isFinite(selectedAmount) || selectedAmount <= 0) {
        throw new BadRequestException(
          `قيمة خصم السلفة ${advance.invoiceNumber} يجب أن تكون أكبر من صفر.`,
        );
      }
      if (selectedAmount - remainingAmount > MONEY_EPSILON) {
        throw new BadRequestException(
          `قيمة خصم السلفة ${advance.invoiceNumber} تتجاوز الرصيد المتبقي. حدّث المسير وحاول مجددًا.`,
        );
      }
      selectedTotal += selectedAmount;
    }
    if (Math.abs(selectedTotal - Number(item.advancesDeduct ?? 0)) > MONEY_EPSILON) {
      throw new BadRequestException('إجمالي خصم السلف لا يطابق السلف المحددة.');
    }
  }
}

import { Prisma } from '@prisma/client';
import type { PayrollRunItemDto } from './dto/create-payroll-run.dto';

export type PayrollRunItemCreateData = {
  employeeId: string;
  grossSalary: Prisma.Decimal;
  allowancesAdd: Prisma.Decimal;
  deductions: Prisma.Decimal;
  advancesDeduct: Prisma.Decimal;
  advanceSelections?: Prisma.InputJsonValue;
  netSalary: Prisma.Decimal;
  notes?: string;
};

export function buildPayrollRunItemsData(items: PayrollRunItemDto[]) {
  let totalAmount = 0;
  const itemsData: PayrollRunItemCreateData[] = items.map((item) => {
    totalAmount += Number(item.netSalary ?? 0);
    return {
      employeeId: item.employeeId,
      grossSalary: new Prisma.Decimal(item.grossSalary),
      allowancesAdd: new Prisma.Decimal(item.allowancesAdd ?? 0),
      deductions: new Prisma.Decimal(item.deductions ?? 0),
      advancesDeduct: new Prisma.Decimal(item.advancesDeduct ?? 0),
      advanceSelections: item.advanceSelections as Prisma.InputJsonValue | undefined,
      netSalary: new Prisma.Decimal(item.netSalary),
      notes: item.notes,
    };
  });

  return { itemsData, totalAmount };
}

export function buildPayrollRunVaultSplitIds(vaultSplits: { vaultId: string }[] | null | undefined) {
  return (vaultSplits ?? []).map((vaultSplit) => vaultSplit.vaultId);
}

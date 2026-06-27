import { BadRequestException } from '@nestjs/common';
import type { PayrollRunItemDto } from './dto/create-payroll-run.dto';

const HR_META = '[HR_META]';
const EPS = 0.02;

type PayrollEmployee = {
  id: string;
  joinDate: Date | string | null;
  status?: string | null;
  notes?: string | null;
};

type CompensationSnapshot = {
  employeeId?: string;
  salaryPackage?: {
    total?: unknown;
  };
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseTerminationDateFromNotes(notes: string | null | undefined): Date | null {
  const raw = String(notes || '');
  const idx = raw.lastIndexOf(HR_META);
  if (idx < 0) return null;
  try {
    const meta = JSON.parse(raw.slice(idx + HR_META.length).trim()) as { terminationDate?: string };
    if (!meta.terminationDate) return null;
    const d = new Date(meta.terminationDate);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function countInclusiveCalendarDays(a: Date, b: Date): number {
  const da = new Date(a);
  da.setHours(0, 0, 0, 0);
  const db = new Date(b);
  db.setHours(0, 0, 0, 0);
  if (db < da) return 0;
  return Math.round((db.getTime() - da.getTime()) / 86400000) + 1;
}

export function getPayrollEmploymentProrationFactor(employee: PayrollEmployee, payrollMonth: Date): number {
  const monthStart = new Date(payrollMonth);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  monthEnd.setHours(0, 0, 0, 0);
  const daysInMonth = countInclusiveCalendarDays(monthStart, monthEnd);
  if (daysInMonth <= 0) return 0;

  const join = new Date(employee.joinDate || '');
  if (Number.isNaN(join.getTime())) {
    throw new BadRequestException('تاريخ التحاق الموظف غير صالح في مسير الرواتب.');
  }
  join.setHours(0, 0, 0, 0);

  const effectiveStart = join > monthStart ? join : monthStart;
  let effectiveEnd = monthEnd;
  if (employee.status === 'terminated') {
    const terminationDate = parseTerminationDateFromNotes(employee.notes);
    if (terminationDate) {
      terminationDate.setHours(0, 0, 0, 0);
      if (terminationDate < effectiveEnd) effectiveEnd = terminationDate;
    }
  }

  if (effectiveStart > effectiveEnd) return 0;
  const employedDays = countInclusiveCalendarDays(effectiveStart, effectiveEnd);
  return Math.min(1, Math.max(0, employedDays / daysInMonth));
}

export function assertPayrollItemsGrossMatchesCentralSnapshots({
  items,
  employeesById,
  snapshotByEmployeeId,
  payrollMonth,
}: {
  items: PayrollRunItemDto[];
  employeesById: Map<string, PayrollEmployee>;
  snapshotByEmployeeId: Map<string, CompensationSnapshot>;
  payrollMonth: Date;
}): void {
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const employee = employeesById.get(item.employeeId);
    if (!employee) {
      throw new BadRequestException(`السطر ${i + 1}: الموظف غير موجود أو لا ينتمي للشركة.`);
    }

    const snapshot = snapshotByEmployeeId.get(item.employeeId);
    const monthlyTotal = Number(snapshot?.salaryPackage?.total);
    if (!Number.isFinite(monthlyTotal) || monthlyTotal <= 0) {
      throw new BadRequestException(`السطر ${i + 1}: تعذر تحميل إجمالي راتب الموظف من المصدر المركزي.`);
    }

    const factor = getPayrollEmploymentProrationFactor(employee, payrollMonth);
    const expectedGross = roundMoney(monthlyTotal * factor);
    const actualGross = Number(item.grossSalary);
    if (!Number.isFinite(actualGross) || Math.abs(actualGross - expectedGross) > EPS) {
      throw new BadRequestException(
        `السطر ${i + 1}: إجمالي الراتب (${actualGross}) لا يطابق المصدر المركزي (المتوقع ≈ ${expectedGross.toFixed(2)}).`,
      );
    }
  }
}

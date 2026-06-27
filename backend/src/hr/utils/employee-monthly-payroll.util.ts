import Decimal from 'decimal.js';
import type { Prisma } from '@prisma/client';
import { computeHrEmployeeSalaryPackage } from './employee-salary-package.util';

type ActiveEmployeePayRow = {
  id: string;
  basicSalary: Prisma.Decimal | number | string;
  housingAllowance: Prisma.Decimal | number | string;
  transportAllowance: Prisma.Decimal | number | string;
  otherAllowance: Prisma.Decimal | number | string;
  workHours: string | null;
  workSchedule: string | null;
};

export function sumMonthlyPayrollForActiveEmployees(
  employees: ActiveEmployeePayRow[],
  customAllowanceByEmployeeId: Map<string, number>,
): number {
  let sum = new Decimal(0);
  for (const emp of employees) {
    const custom = customAllowanceByEmployeeId.get(emp.id) ?? 0;
    sum = sum.plus(computeHrEmployeeSalaryPackage(emp, custom).total);
  }
  return Number(sum.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toString());
}

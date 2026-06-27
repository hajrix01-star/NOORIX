/**
 * تطبيق زيادة/ترقية على ملف الموظف + تسجيل الحركة — نفس منطق EmployeeCareerMovementModal.
 */
import { createMovement, updateEmployee } from '../../../services/api';
import { rejectIfApiFailed } from '../../../utils/apiResponse';
import { roundMoney2 } from '../../../utils/moneyInput';
import {
  basicSalaryFromTargetTotalInclusiveOvertime,
  computeEmployeeSalaryPackageBreakdown,
  sumCustomAllowancesForEmployee,
} from './employeeSalaryMath';

type AllowanceRow = { employeeId?: string; amount?: unknown };

export function resolveRaiseIncrement(
  mvAmount: string,
  mvNew: string,
  currentTotal: number,
): number | null {
  const rawAmt = String(mvAmount ?? '').trim().replace(',', '.');
  if (rawAmt !== '' && rawAmt !== '-' && rawAmt !== '+') {
    const inc = roundMoney2(rawAmt);
    if (Number.isFinite(inc) && inc !== 0) return inc;
  }

  const rawNew = String(mvNew ?? '').trim().replace(',', '.');
  const arrowMatch = rawNew.match(/(\d+(?:\.\d+)?)\s*(?:→|->|-)\s*(\d+(?:\.\d+)?)/);
  if (arrowMatch?.[2]) {
    const newTarget = roundMoney2(arrowMatch[2]);
    if (Number.isFinite(newTarget)) return roundMoney2(newTarget - currentTotal);
  }
  const singleNum = rawNew.match(/^(\d+(?:\.\d+)?)$/);
  if (singleNum?.[1]) {
    const newTarget = roundMoney2(singleNum[1]);
    if (Number.isFinite(newTarget) && newTarget !== currentTotal) {
      return roundMoney2(newTarget - currentTotal);
    }
  }
  return null;
}

export async function applyCareerRaise(params: {
  employee: Record<string, unknown> & { id?: string };
  companyId: string;
  customAllowances: AllowanceRow[];
  increment: number;
  effectiveDate: string;
  notes?: string;
}) {
  const { employee, companyId, customAllowances, increment, effectiveDate, notes } = params;
  const employeeId = String(employee.id || '');
  if (!employeeId) throw new Error('Employee id required');

  const customTotal = sumCustomAllowancesForEmployee(customAllowances, employeeId);
  const currentTotalAllIn = computeEmployeeSalaryPackageBreakdown(employee, customTotal).total;
  const newTarget = roundMoney2(currentTotalAllIn + increment);
  if (newTarget <= 0) {
    throw new Error('Invalid new salary total');
  }

  const { basic, inverseWarning } = basicSalaryFromTargetTotalInclusiveOvertime(
    employee,
    customTotal,
    newTarget,
  );
  if (inverseWarning || basic <= 0) {
    throw new Error('Cannot derive basic salary from target total');
  }

  const up = await updateEmployee(employeeId, { basicSalary: basic }, companyId);
  rejectIfApiFailed(up, 'Failed to update employee salary');

  const mov = await createMovement({
    companyId,
    employeeId,
    movementType: 'raise',
    amount: increment > 0 ? increment : undefined,
    previousValue: String(roundMoney2(currentTotalAllIn)),
    newValue: String(roundMoney2(newTarget)),
    effectiveDate: `${effectiveDate}T12:00:00.000Z`,
    notes: notes || undefined,
  });
  rejectIfApiFailed(mov, 'Failed to record raise movement');

  return { basic, newTarget, currentTotalAllIn, increment };
}

export async function applyCareerPromotion(params: {
  employee: Record<string, unknown> & { id?: string; jobTitle?: string };
  companyId: string;
  newJobTitle: string;
  previousJobTitle?: string;
  effectiveDate: string;
  notes?: string;
}) {
  const { employee, companyId, newJobTitle, previousJobTitle, effectiveDate, notes } = params;
  const employeeId = String(employee.id || '');
  if (!employeeId) throw new Error('Employee id required');

  const prev = (previousJobTitle ?? employee.jobTitle ?? '').trim();
  const next = newJobTitle.trim();
  if (!next) throw new Error('New job title required');

  const up = await updateEmployee(employeeId, { jobTitle: next }, companyId);
  rejectIfApiFailed(up, 'Failed to update job title');

  const mov = await createMovement({
    companyId,
    employeeId,
    movementType: 'promotion',
    previousValue: prev || undefined,
    newValue: next,
    effectiveDate: `${effectiveDate}T12:00:00.000Z`,
    notes: notes || undefined,
  });
  rejectIfApiFailed(mov, 'Failed to record promotion movement');
}

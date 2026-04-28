/**
 * Payroll run row math — logic moved verbatim from PayrollRunFormModal; do not alter formulas.
 */
import { hrFmt } from '../../../utils/hrFmt';
import { formatSaudiDate } from '../../../../../utils/saudiDate';
import { employeeDisplayName } from '../../../../../utils/employeeDisplayName';
import { roundMoney2 } from '../../../../../utils/moneyInput';
import { parseOvertimeWorkDaysPerMonth, totalSalary } from '../../../utils/employeeSalaryMath';
import {
  filterLeaveDaySetToEmploymentWindow,
  getEmploymentProrationInMonth,
  toLocalDayKey,
} from '../../../utils/payrollAttendanceMath';
import type { PayrollAdvanceDueRow, PayrollRunLineItem } from '../types';
import {
  ceilAmount,
  monthRange,
  parseDeferredMonth,
} from './payrollRunMappers';

type CustomAllowanceRow = { employeeId?: string; amount?: unknown };

export function computeAllowanceTotals(allCustomAllowances: CustomAllowanceRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of allCustomAllowances) {
    if (!row.employeeId) continue;
    map.set(row.employeeId, (map.get(row.employeeId) || 0) + (Number(row.amount) || 0));
  }
  return map;
}

export function computeLeaveSettledEmployeeIds(
  leaveSalarySettlements: Array<{ employeeId?: string }>,
): Set<string> {
  const set = new Set<string>();
  for (const s of leaveSalarySettlements) {
    if (s?.employeeId) set.add(s.employeeId);
  }
  return set;
}

export function computeExistingMonthSet(existingRuns: unknown[], runId: string | null): Set<string> {
  const set = new Set<string>();
  (existingRuns || []).forEach((r) => {
    const row = r as { id?: string; payrollMonth?: string | Date };
    if (runId && row.id === runId) return;
    const m = row.payrollMonth ? new Date(row.payrollMonth) : null;
    if (m) set.add(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
  });
  return set;
}

export function computeUnpaidLeaveDaysByEmployee(
  leaves: Array<{
    employeeId?: string;
    status?: string;
    leaveType?: string;
    startDate?: string | Date;
    endDate?: string | Date;
  }>,
  payrollMonth: string,
  defaultMonth: string,
): Map<string, Set<string>> {
  const { start, end } = monthRange(payrollMonth || defaultMonth);
  const map = new Map<string, Set<string>>();
  for (const leave of leaves || []) {
    if (!leave?.employeeId || leave.status !== 'approved') continue;
    if (leave.leaveType !== 'unpaid') continue;
    const overlapStart = new Date(Math.max(new Date(leave.startDate as string).getTime(), start.getTime()));
    const overlapEnd = new Date(Math.min(new Date(leave.endDate as string).getTime(), end.getTime()));
    if (overlapStart > overlapEnd) continue;
    const days = map.get(leave.employeeId) || new Set<string>();
    const cursor = new Date(overlapStart);
    cursor.setHours(0, 0, 0, 0);
    const overlapEndDay = new Date(overlapEnd);
    overlapEndDay.setHours(0, 0, 0, 0);
    while (cursor <= overlapEndDay) {
      days.add(toLocalDayKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    map.set(leave.employeeId, days);
  }
  return map;
}

export function computeActiveEmployees(
  employees: Array<{ status?: string; id?: string }>,
): Array<{ status?: string; id?: string }> {
  return (employees || []).filter((e) => e.status !== 'terminated' && e.status !== 'archived');
}

export function computeEligibleEmployees(
  activeEmployees: Array<{ id?: string; status?: string }>,
  payrollMonth: string,
  defaultMonth: string,
  leaveSettledEmployeeIds: Set<string>,
): Array<{ id?: string; status?: string }> {
  const pm = payrollMonth || defaultMonth;
  return activeEmployees.filter((e) => {
    if (!e.id || leaveSettledEmployeeIds.has(e.id)) return false;
    return getEmploymentProrationInMonth(e, pm).factor > 0;
  });
}

export function computeDisplayEmployees(
  eligibleEmployees: Array<{ id?: string }>,
  items: PayrollRunLineItem[],
  employees: Array<{ id?: string; name?: string; nameAr?: string }>,
): Array<{ id?: string; name?: string; nameAr?: string }> {
  const map = new Map<string, { id?: string; name?: string; nameAr?: string }>();
  eligibleEmployees.forEach((emp) => {
    if (emp.id) map.set(emp.id, emp);
  });
  items.forEach((item) => {
    if (!item.employeeId || map.has(item.employeeId)) return;
    const fromList = (employees || []).find((e) => e.id === item.employeeId);
    map.set(
      item.employeeId,
      fromList || { id: item.employeeId, name: item.employeeName, nameAr: item.employeeName },
    );
  });
  return Array.from(map.values());
}

export function computeTotalNet(items: PayrollRunLineItem[]): number {
  return items.reduce((s, i) => s + (i.netSalary ?? 0), 0);
}

type InvoiceLike = {
  id?: string;
  employeeId?: string;
  status?: string;
  totalAmount?: unknown;
  settledAmount?: unknown;
  notes?: unknown;
  transactionDate?: unknown;
  installmentAmount?: unknown;
  installmentCount?: number | null;
};

export function buildAdvancesByEmployee(
  advances: InvoiceLike[],
  monthStr: string,
): Map<string, PayrollAdvanceDueRow[]> {
  const map = new Map<string, PayrollAdvanceDueRow[]>();
  for (const inv of advances || []) {
    if (!inv?.employeeId || inv?.status === 'cancelled') continue;
    const total = Number(inv.totalAmount ?? 0);
    const settled = Number(inv.settledAmount ?? 0);
    const remaining = Math.max(0, total - settled);
    if (remaining <= 0) continue;
    const deferMonth = parseDeferredMonth(inv.notes);
    const isDeferred = !!deferMonth && deferMonth > monthStr;
    const instAmt = inv.installmentAmount ? Number(inv.installmentAmount) : null;
    const dueThisMonth = instAmt ? Math.min(instAmt, remaining) : remaining;
    const row: PayrollAdvanceDueRow = {
      id: inv.id as string,
      transactionDate: inv.transactionDate,
      remaining: dueThisMonth,
      fullRemaining: remaining,
      isDeferred,
      installmentCount: inv.installmentCount ?? null,
      installmentAmount: instAmt,
    };
    if (!map.has(inv.employeeId)) map.set(inv.employeeId, []);
    map.get(inv.employeeId)!.push(row);
  }
  return map;
}

export function getAdvanceMetaForEmployee(
  advancesByEmployee: Map<string, PayrollAdvanceDueRow[]>,
  empId: string,
): { dueAmount: number; datesLabel: string } {
  const rows = advancesByEmployee.get(empId) || [];
  const dueRows = rows.filter((r) => !r.isDeferred);
  const dueAmount = dueRows.reduce((s, r) => s + r.remaining, 0);
  const datesLabel = dueRows.map((r) => formatSaudiDate(r.transactionDate)).join(' ، ');
  return {
    dueAmount,
    datesLabel,
  };
}

type BuildLineDeps = {
  emp: Record<string, unknown> & { id?: string };
  payrollMonth: string;
  defaultMonth: string;
  allowanceTotals: Map<string, number>;
  unpaidLeaveDaysByEmployee: Map<string, Set<string>>;
  advancesByEmployee: Map<string, PayrollAdvanceDueRow[]>;
  lang: string;
  t: (key: string, ...subst: string[]) => string;
};

export function buildPayrollLineForEmployee(deps: BuildLineDeps): PayrollRunLineItem {
  const {
    emp,
    payrollMonth,
    defaultMonth,
    allowanceTotals,
    unpaidLeaveDaysByEmployee,
    advancesByEmployee,
    lang,
    t,
  } = deps;
  const customSum = (emp.id && allowanceTotals.get(emp.id)) || 0;
  const fullGross = totalSalary(emp, customSum);
  const pr = getEmploymentProrationInMonth(emp, payrollMonth || defaultMonth);
  const grossProrated = roundMoney2(fullGross * pr.factor);
  const rawUnpaid = (emp.id && unpaidLeaveDaysByEmployee.get(emp.id)) || new Set<string>();
  const unpaidInWindow = filterLeaveDaySetToEmploymentWindow(rawUnpaid, pr.effectiveStart, pr.effectiveEnd);
  const unpaidDays = unpaidInWindow.size;
  const workDays = Math.max(1, parseOvertimeWorkDaysPerMonth(emp));
  const appliedUnpaid = Math.min(unpaidDays, workDays);
  const leaveDeduction = appliedUnpaid
    ? Math.min(grossProrated, ceilAmount((grossProrated * appliedUnpaid) / workDays))
    : 0;
  const advRows = (emp.id && advancesByEmployee.get(emp.id)) || [];
  const dueAdv = advRows.filter((r) => !r.isDeferred);
  const advancesDeduct = dueAdv.reduce((s, r) => s + r.remaining, 0);
  const advanceDatesLabel = dueAdv
    .map((r) => {
      const dateStr = formatSaudiDate(r.transactionDate);
      if (r.installmentAmount && r.installmentCount) {
        const paidCount = r.installmentCount - Math.ceil(r.fullRemaining / r.installmentAmount);
        return `${dateStr} (${paidCount + 1}/${r.installmentCount})`;
      }
      return dateStr;
    })
    .join(' ، ');
  const netSalary = Math.max(0, grossProrated - leaveDeduction - advancesDeduct);
  const notesParts: string[] = [];
  if (advanceDatesLabel) notesParts.push(`تواريخ السلف: ${advanceDatesLabel}`);
  if (pr.factor < 1 && pr.daysInMonth > 0) {
    notesParts.push(t('payrollEmploymentProrationNote', String(pr.employedDays), String(pr.daysInMonth)));
  }
  if (appliedUnpaid > 0) {
    notesParts.push(t('payrollUnpaidLeaveDeductionNote', String(appliedUnpaid), hrFmt(leaveDeduction)));
  }
  return {
    employeeId: emp.id as string,
    employeeName: employeeDisplayName(emp, lang),
    grossSalary: grossProrated,
    allowancesAdd: 0,
    deductions: leaveDeduction,
    advancesDeduct,
    netSalary,
    deferAdvances: false,
    advanceDates: advanceDatesLabel,
    notes: notesParts.join(' | '),
  };
}

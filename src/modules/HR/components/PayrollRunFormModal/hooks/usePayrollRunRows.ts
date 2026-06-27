import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { toYmd } from '../../../../../utils/saudiDate';
import { employeeDisplayName } from '../../../../../utils/employeeDisplayName';
import { useTranslation } from '../../../../../i18n/useTranslation';
import {
  buildAdvancesByEmployee,
  buildPayrollLineForEmployee,
  computeActiveEmployees,
  computeAllowanceTotals,
  computeDisplayEmployees,
  computeEligibleEmployees,
  computeExistingMonthSet,
  computeLeaveSettledEmployeeIds,
  computeTotalNet,
  computeUnpaidLeaveDaysByEmployee,
  getAdvanceMetaForEmployee,
} from '../utils/payrollRunCalculations';
import { computeSettledDaysByEmployee } from '../../../utils/payrollAttendanceMath';
import { payrollMonthAlreadyExists } from '../utils/payrollRunValidators';
import {
  extractAdvanceDates,
  parseDeferredMonth,
} from '../utils/payrollRunMappers';
import type { PayrollRunLineItem } from '../types';
import { computePayrollLineNet } from '../../../utils/hrCalculations/payroll';

type StateShape = {
  defaultMonth: string;
  payrollMonth: string;
  setPayrollMonth: (v: string) => void;
  setNotes: (v: string) => void;
  setItems: React.Dispatch<React.SetStateAction<PayrollRunLineItem[]>>;
  items: PayrollRunLineItem[];
  isEditMode: boolean;
  runId: string | null;
  employees: Array<Record<string, unknown> & { id?: string; status?: string; name?: string; nameAr?: string }>;
  existingRuns: unknown[];
  editingRun: {
    payrollMonth?: string | Date;
    notes?: string;
    items?: Array<{
      employeeId?: string;
      employeeName?: string;
      employee?: { id?: string; name?: string; nameAr?: string };
      grossSalary?: unknown;
      allowancesAdd?: unknown;
      deductions?: unknown;
      advancesDeduct?: unknown;
      netSalary?: unknown;
      notes?: string;
    }>;
  } | undefined;
  monthStr: string;
  allCustomAllowances: Array<{ employeeId?: string; amount?: unknown }>;
  advances: unknown[];
  leaves: unknown[];
  leaveSalarySettlements: Array<{ employeeId?: string }>;
};

export function usePayrollRunRows(state: StateShape) {
  const { t, lang } = useTranslation();
  const {
    defaultMonth,
    payrollMonth,
    setPayrollMonth,
    setNotes,
    setItems,
    items,
    isEditMode,
    runId,
    employees,
    existingRuns,
    editingRun,
    monthStr,
    allCustomAllowances,
    advances,
    leaves,
    leaveSalarySettlements,
  } = state;

  const allowanceTotals = useMemo(() => computeAllowanceTotals(allCustomAllowances), [allCustomAllowances]);

  const leaveSettledEmployeeIds = useMemo(
    () => computeLeaveSettledEmployeeIds(leaveSalarySettlements),
    [leaveSalarySettlements],
  );

  const existingMonthSet = useMemo(
    () => computeExistingMonthSet(existingRuns, runId),
    [existingRuns, runId],
  );

  const alreadyExists = useMemo(
    () => payrollMonthAlreadyExists(monthStr, existingMonthSet),
    [monthStr, existingMonthSet],
  );

  const activeEmployees = useMemo(() => computeActiveEmployees(employees), [employees]);

  const leaveDaysByEmployee = useMemo(
    () => computeUnpaidLeaveDaysByEmployee(leaves as never[], payrollMonth, defaultMonth),
    [leaves, payrollMonth, defaultMonth],
  );

  const settledDaysByEmployee = useMemo(
    () => computeSettledDaysByEmployee(employees, payrollMonth || defaultMonth, leaveSalarySettlements),
    [employees, payrollMonth, defaultMonth, leaveSalarySettlements],
  );

  const eligibleEmployees = useMemo(
    () => computeEligibleEmployees(activeEmployees, payrollMonth, defaultMonth, leaveDaysByEmployee, settledDaysByEmployee),
    [activeEmployees, payrollMonth, defaultMonth, leaveDaysByEmployee, settledDaysByEmployee],
  );

  const displayEmployees = useMemo(
    () => computeDisplayEmployees(eligibleEmployees, items, employees),
    [eligibleEmployees, items, employees],
  );

  const totalNet = useMemo(() => computeTotalNet(items), [items]);

  const advancesByEmployee = useMemo(
    () => buildAdvancesByEmployee(advances as never[], monthStr),
    [advances, monthStr],
  );

  const getMeta = useCallback(
    (empId: string) => getAdvanceMetaForEmployee(advancesByEmployee, empId),
    [advancesByEmployee],
  );

  const buildLineForEmployee = useCallback(
    (emp: Record<string, unknown> & { id?: string }) =>
      buildPayrollLineForEmployee({
        emp,
        payrollMonth,
        defaultMonth,
        allowanceTotals,
        leaveDaysByEmployee,
        settledDaysByEmployee,
        advancesByEmployee,
        lang,
        t,
      }),
    [
      payrollMonth,
      defaultMonth,
      allowanceTotals,
      leaveDaysByEmployee,
      settledDaysByEmployee,
      advancesByEmployee,
      lang,
      t,
    ],
  );

  const initItems = useCallback(() => {
    setItems(eligibleEmployees.map((e) => buildLineForEmployee(e as Record<string, unknown> & { id?: string })));
  }, [eligibleEmployees, buildLineForEmployee, setItems]);

  const prevPayrollMonthForInitRef = useRef(payrollMonth);

  const loadEditingItems = useCallback(() => {
    if (!editingRun) return;
    const loadedMonth = editingRun.payrollMonth ? toYmd(editingRun.payrollMonth) : defaultMonth;
    const loadedAdvancesByEmployee = buildAdvancesByEmployee(advances as never[], loadedMonth);
    setPayrollMonth(loadedMonth);
    setNotes(editingRun.notes || '');
    const loadedItems = (editingRun.items || []).map((row) => {
      const employeeId = row.employeeId || row.employee?.id || '';
      const employeeName = employeeDisplayName(row.employee || { name: row.employeeName }, lang);
      const savedAdvanceDates = extractAdvanceDates(row.notes);
      const savedAdvancesDeduct = Number(row.advancesDeduct ?? 0);
      const deferAdvances = savedAdvancesDeduct <= 0 && !!parseDeferredMonth(row.notes);
      const currentAdvanceMeta = employeeId
        ? getAdvanceMetaForEmployee(loadedAdvancesByEmployee, employeeId)
        : { dueAmount: 0, datesLabel: '' };
      const advancesDeduct = deferAdvances ? 0 : Number(currentAdvanceMeta.dueAmount || 0);
      const grossSalary = Number(row.grossSalary ?? 0);
      const allowancesAdd = Number(row.allowancesAdd ?? 0);
      const deductions = Number(row.deductions ?? 0);
      return {
        employeeId,
        employeeName,
        grossSalary,
        allowancesAdd,
        deductions,
        advancesDeduct,
        netSalary: computePayrollLineNet({ grossSalary, allowancesAdd, deductions, advancesDeduct }),
        deferAdvances,
        advanceDates: currentAdvanceMeta.datesLabel || savedAdvanceDates,
        notes: row.notes || '',
      };
    });
    setItems(loadedItems);
  }, [advances, defaultMonth, editingRun, lang, setItems, setNotes, setPayrollMonth]);

  useEffect(() => {
    if (isEditMode) return;
    if (eligibleEmployees.length === 0) return;

    if (items.length === 0) {
      initItems();
      prevPayrollMonthForInitRef.current = payrollMonth;
      return;
    }

    const monthChanged = prevPayrollMonthForInitRef.current !== payrollMonth;
    if (monthChanged) {
      initItems();
      prevPayrollMonthForInitRef.current = payrollMonth;
    }
  }, [isEditMode, eligibleEmployees.length, payrollMonth, items.length, initItems]);

  useEffect(() => {
    if (!isEditMode || !editingRun) return;
    loadEditingItems();
  }, [isEditMode, editingRun, loadEditingItems]);

  return {
    t,
    lang,
    allowanceTotals,
    leaveSettledEmployeeIds,
    existingMonthSet,
    alreadyExists,
    activeEmployees,
    leaveDaysByEmployee,
    settledDaysByEmployee,
    eligibleEmployees,
    displayEmployees,
    totalNet,
    advancesByEmployee,
    getAdvanceMetaForEmployee: getMeta,
    buildLineForEmployee,
    initItems,
    loadEditingItems,
  };
}

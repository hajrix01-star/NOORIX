import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { formatSaudiDate, toYmd } from '../../../../../utils/saudiDate';
import { employeeDisplayName } from '../../../../../utils/employeeDisplayName';
import { useTranslation } from '../../../../../i18n/useTranslation';
import {
  buildAdvancesByEmployee,
  buildManualDeductionsByEmployee,
  buildPayrollLineForEmployee,
  computeActiveEmployees,
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
import type { HrCompensationSnapshot } from '../../../../../types/api';
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
      advanceSelections?: Array<{ advanceId?: string; amount?: unknown }> | null;
      netSalary?: unknown;
      notes?: string;
    }>;
  } | undefined;
  monthStr: string;
  compensationSnapshotByEmployeeId: Map<string, HrCompensationSnapshot>;
  advances: Array<Record<string, unknown>>;
  deductions: Array<{
    employeeId?: string;
    deductionType?: string | null;
    amount?: unknown;
    transactionDate?: unknown;
  }>;
  leaves: Array<{
    employeeId?: string;
    status?: string;
    leaveType?: string;
    startDate?: string | Date;
    endDate?: string | Date;
  }>;
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
    compensationSnapshotByEmployeeId,
    advances,
    deductions,
    leaves,
    leaveSalarySettlements,
  } = state;

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
    () => computeUnpaidLeaveDaysByEmployee(leaves, payrollMonth, defaultMonth),
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

  const missingCentralSalaryEmployeeIds = useMemo(
    () =>
      eligibleEmployees
        .map((employee) => String(employee.id || ''))
        .filter((employeeId) => employeeId && !compensationSnapshotByEmployeeId.has(employeeId)),
    [eligibleEmployees, compensationSnapshotByEmployeeId],
  );

  const displayEmployees = useMemo(
    () => computeDisplayEmployees(eligibleEmployees, items, employees),
    [eligibleEmployees, items, employees],
  );

  const totalNet = useMemo(() => computeTotalNet(items), [items]);

  const advancesByEmployee = useMemo(
    () => buildAdvancesByEmployee(advances, monthStr),
    [advances, monthStr],
  );

  const manualDeductionsByEmployee = useMemo(
    () => buildManualDeductionsByEmployee(deductions, monthStr),
    [deductions, monthStr],
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
        compensationSnapshotByEmployeeId,
        leaveDaysByEmployee,
        settledDaysByEmployee,
        advancesByEmployee,
        manualDeductionsByEmployee,
        lang,
        t,
      }),
    [
      payrollMonth,
      defaultMonth,
      compensationSnapshotByEmployeeId,
      leaveDaysByEmployee,
      settledDaysByEmployee,
      advancesByEmployee,
      manualDeductionsByEmployee,
      lang,
      t,
    ],
  );

  const initItems = useCallback(() => {
    if (missingCentralSalaryEmployeeIds.length > 0) {
      setItems([]);
      return;
    }
    setItems(eligibleEmployees.map((e) => buildLineForEmployee(e as Record<string, unknown> & { id?: string })));
  }, [eligibleEmployees, buildLineForEmployee, missingCentralSalaryEmployeeIds.length, setItems]);

  const prevPayrollMonthForInitRef = useRef(payrollMonth);

  const loadEditingItems = useCallback(() => {
    if (!editingRun) return;
    const loadedMonth = editingRun.payrollMonth ? toYmd(editingRun.payrollMonth) : defaultMonth;
    const loadedAdvancesByEmployee = buildAdvancesByEmployee(advances, loadedMonth);
    setPayrollMonth(loadedMonth);
    setNotes(editingRun.notes || '');
    const loadedItems = (editingRun.items || []).map((row) => {
      const employeeId = row.employeeId || row.employee?.id || '';
      const employeeName = employeeDisplayName(row.employee || { name: row.employeeName }, lang);
      const savedAdvanceDates = extractAdvanceDates(row.notes);
      const savedAdvancesDeduct = Number(row.advancesDeduct ?? 0);
      const deferAdvances = savedAdvancesDeduct <= 0 && !!parseDeferredMonth(row.notes);
      const currentAdvanceRows = employeeId ? loadedAdvancesByEmployee.get(employeeId) || [] : [];
      const hasExplicitSelections = Array.isArray(row.advanceSelections);
      const selectedIds = new Set(
        hasExplicitSelections
          ? (row.advanceSelections || []).map((selection) => String(selection.advanceId || '')).filter(Boolean)
          : [],
      );
      let legacyAmountLeft = savedAdvancesDeduct;
      const advanceChoices = currentAdvanceRows.map((advance) => {
        const selected = hasExplicitSelections
          ? selectedIds.has(advance.id)
          : !deferAdvances && legacyAmountLeft > 0 && (() => {
              legacyAmountLeft -= advance.remaining;
              return true;
            })();
        return {
          advanceId: advance.id,
          invoiceNumber: advance.invoiceNumber,
          transactionDate: advance.transactionDate,
          dateLabel: formatSaudiDate(advance.transactionDate),
          amount: advance.remaining,
          remaining: advance.fullRemaining,
          selected,
        };
      });
      const advancesDeduct = advanceChoices
        .filter((advance) => advance.selected)
        .reduce((sum, advance) => sum + advance.amount, 0);
      const selectedAdvanceDates = advanceChoices
        .filter((advance) => advance.selected)
        .map((advance) => advance.dateLabel)
        .join('، ');
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
        deferAdvances: advanceChoices.length > 0 && advanceChoices.every((advance) => !advance.selected),
        advanceDates: selectedAdvanceDates || savedAdvanceDates,
        advanceChoices,
        notes: row.notes || '',
      };
    });
    setItems(loadedItems);
  }, [advances, defaultMonth, editingRun, lang, setItems, setNotes, setPayrollMonth]);

  useEffect(() => {
    if (isEditMode) return;
    if (eligibleEmployees.length === 0) return;
    if (missingCentralSalaryEmployeeIds.length > 0) return;

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
  }, [isEditMode, eligibleEmployees.length, missingCentralSalaryEmployeeIds.length, payrollMonth, items.length, initItems]);

  useEffect(() => {
    if (!isEditMode || !editingRun) return;
    loadEditingItems();
  }, [isEditMode, editingRun, loadEditingItems]);

  return {
    t,
    lang,
    leaveSettledEmployeeIds,
    existingMonthSet,
    alreadyExists,
    activeEmployees,
    leaveDaysByEmployee,
    settledDaysByEmployee,
    eligibleEmployees,
    missingCentralSalaryEmployeeIds,
    displayEmployees,
    totalNet,
    advancesByEmployee,
    getAdvanceMetaForEmployee: getMeta,
    buildLineForEmployee,
    initItems,
    loadEditingItems,
  };
}

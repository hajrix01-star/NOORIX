import React, { useCallback } from 'react';
import { createPayrollRun, updatePayrollRun, throwIfApiFailed } from '../../../../../services/api';
import {
  stripPayrollAdvDeferSegment,
  withPayrollAdvDeferSegment,
} from '../utils/payrollRunMappers';
import { withComputedPayrollLineNet } from '../../../utils/hrCalculations/payroll';
import type { PayrollRunFormModalProps, PayrollRunLineItem } from '../types';

type Args = {
  items: PayrollRunLineItem[];
  setItems: React.Dispatch<React.SetStateAction<PayrollRunLineItem[]>>;
  setError: (s: string) => void;
  setSubmitting: (v: boolean) => void;
  payrollMonth: string;
  notes: string;
  cid: string;
  isEditMode: boolean;
  runId: string | null;
  monthStr: string;
  alreadyExists: boolean;
  t: (key: string, ...subst: string[]) => string;
  onCreate?: PayrollRunFormModalProps['onCreate'];
  onClose?: PayrollRunFormModalProps['onClose'];
  getAdvanceMetaForEmployee: (empId: string) => { dueAmount: number; datesLabel: string };
  buildLineForEmployee: (emp: Record<string, unknown> & { id?: string }) => PayrollRunLineItem;
  employees: Array<Record<string, unknown> & { id?: string }>;
};

export function usePayrollRunFormActions({
  items,
  setItems,
  setError,
  setSubmitting,
  payrollMonth,
  notes,
  cid,
  isEditMode,
  runId,
  monthStr,
  alreadyExists,
  t,
  onCreate,
  onClose,
  getAdvanceMetaForEmployee,
  buildLineForEmployee,
  employees,
}: Args) {
  const updateItem = useCallback(
    (idx: number, field: keyof PayrollRunLineItem, value: string) => {
      const num = parseFloat(value) || 0;
      setItems((prev) => {
        const next = [...prev];
        const row = { ...next[idx], [field]: num } as PayrollRunLineItem;
        next[idx] = withComputedPayrollLineNet(row);
        return next;
      });
    },
    [setItems],
  );

  const toggleDefer = useCallback(
    (employeeId: string) => {
      setItems((prev) =>
        prev.map((row) => {
          if (row.employeeId !== employeeId) return row;
          const nextRow = { ...row };
          const turningOn = !nextRow.deferAdvances;
          nextRow.deferAdvances = turningOn;
          if (turningOn) {
            nextRow.advancesDeduct = 0;
            nextRow.notes = monthStr ? withPayrollAdvDeferSegment(row.notes, monthStr) : row.notes;
          } else {
            const advMeta = getAdvanceMetaForEmployee(nextRow.employeeId);
            nextRow.advancesDeduct = Number(advMeta.dueAmount || 0);
            const stripped = stripPayrollAdvDeferSegment(row.notes);
            nextRow.notes = stripped || undefined;
          }
          return withComputedPayrollLineNet(nextRow);
        }),
      );
    },
    [setItems, monthStr, getAdvanceMetaForEmployee],
  );

  const toggleInclude = useCallback(
    (emp: Record<string, unknown> & { id?: string }) => {
      const idx = items.findIndex((i) => i.employeeId === emp.id);
      if (idx >= 0) {
        setItems((prev) => prev.filter((_, i) => i !== idx));
      } else {
        const resolved = (employees || []).find((e) => e.id === emp.id) || emp;
        setItems((prev) => [...prev, buildLineForEmployee(resolved)]);
      }
    },
    [items, setItems, employees, buildLineForEmployee],
  );

  const handleSubmit = useCallback(
    async (e: React.SyntheticEvent | null) => {
      e?.preventDefault?.();
      setError('');
      if (items.length === 0) {
        setError(t('noEmployees'));
        return;
      }
      if (alreadyExists) {
        setError(t('payrollMonthExists') || 'مسيرة لهذا الشهر موجودة مسبقاً');
        return;
      }
      setSubmitting(true);
      try {
        const itemsPayload = items.map((i) => ({
          employeeId: i.employeeId,
          grossSalary: i.grossSalary,
          allowancesAdd: i.allowancesAdd,
          deductions: i.deductions,
          advancesDeduct: i.advancesDeduct,
          netSalary: i.netSalary,
          notes: i.notes || undefined,
        }));

        const payload = isEditMode
          ? {
              payrollMonth: `${payrollMonth}T00:00:00.000Z`,
              items: itemsPayload,
              notes: notes || undefined,
            }
          : {
              companyId: cid,
              payrollMonth: `${payrollMonth}T00:00:00.000Z`,
              items: itemsPayload,
              notes: notes || undefined,
            };
        const res = isEditMode
          ? await updatePayrollRun(runId as string, cid, payload)
          : await createPayrollRun(payload);
        throwIfApiFailed(res, t('saveFailed'));
        onCreate?.();
        onClose?.();
      } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message?: string }).message) : '';
        setError(msg || t('saveFailed'));
      } finally {
        setSubmitting(false);
      }
    },
    [
      items,
      alreadyExists,
      isEditMode,
      payrollMonth,
      notes,
      cid,
      runId,
      t,
      setError,
      setSubmitting,
      onCreate,
      onClose,
    ],
  );

  const selectInput = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    try {
      e.target.select();
    } catch {
      /* ignore */
    }
  }, []);

  return {
    updateItem,
    toggleDefer,
    toggleInclude,
    handleSubmit,
    selectInput,
  };
}

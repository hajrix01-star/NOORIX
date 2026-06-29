import { useMemo, useState } from 'react';
import {
  getEmployees,
  getInvoices,
  getLeaves,
  getPayrollRun,
  getPayrollRuns,
  getLeaveSalarySettlements,
  getEmployeeCompensationSnapshots,
} from '../../../../../services/api';
import { useApiListQuery, useApiQuery } from '../../../../../hooks/useApiQuery';
import { employeeKeys, hrKeys, invoiceKeys } from '../../../../../services/queryKeys';
import { getDefaultPayrollMonth } from '../utils/payrollRunMappers';
import type { PayrollRunLineItem } from '../types';

export function usePayrollRunFormState({
  companyId,
  activeCompanyId,
  runId,
}: {
  companyId?: string;
  activeCompanyId?: string | null;
  runId: string | null;
}) {
  const cid = companyId || activeCompanyId || '';
  const isEditMode = !!runId;
  const defaultMonth = getDefaultPayrollMonth();

  const [payrollMonth, setPayrollMonth] = useState(defaultMonth);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PayrollRunLineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: employees = [] } = useApiListQuery<any>({
    queryKey: employeeKeys.list(cid, false),
    queryFn: () => getEmployees(cid, false),
    fallbackMessage: 'فشل تحميل الموظفين',
    enabled: !!cid,
  });

  const { data: existingRuns = [] } = useApiListQuery<any>({
    queryKey: hrKeys.payrollRuns(cid, new Date(payrollMonth).getFullYear()),
    queryFn: () => getPayrollRuns(cid, new Date(payrollMonth).getFullYear()),
    fallbackMessage: 'فشل تحميل مسيرات الرواتب',
    enabled: !!cid && !!payrollMonth,
  });

  const { data: editingRun, isLoading: isLoadingRun } = useApiQuery<any>({
    queryKey: hrKeys.payrollRun(runId, cid),
    queryFn: () => getPayrollRun(runId as string, cid),
    fallbackMessage: 'فشل تحميل المسيرة',
    enabled: !!cid && !!runId,
  });

  const monthStart = payrollMonth ? new Date(payrollMonth) : null;
  const monthStr = monthStart ? `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}` : '';

  const employeeIds = useMemo(
    () => (employees as Array<{ id?: string }>).map((emp) => String(emp.id || '')).filter(Boolean),
    [employees],
  );
  const {
    data: compensationSnapshots,
    isLoading: compensationSnapshotsLoading,
    error: compensationSnapshotsError,
  } = useApiQuery<any>({
    queryKey: hrKeys.compensationSnapshots(cid, employeeIds),
    queryFn: () => getEmployeeCompensationSnapshots(cid, employeeIds),
    enabled: !!cid && employeeIds.length > 0,
    fallbackMessage: 'فشل تحميل بيانات الرواتب المركزية',
  });

  const compensationSnapshotByEmployeeId = useMemo(() => {
    const map = new Map<string, any>();
    for (const snapshot of compensationSnapshots?.items ?? []) {
      if (snapshot?.employeeId) map.set(String(snapshot.employeeId), snapshot);
    }
    return map;
  }, [compensationSnapshots]);

  const { data: advances = [] } = useApiListQuery<any>({
    queryKey: invoiceKeys.advancesForMonth(cid, monthStr),
    queryFn: () => getInvoices(cid, undefined, undefined, 1, 1000, null, null, 'advance'),
    fallbackMessage: 'فشل تحميل السلف',
    enabled: !!cid,
  });

  const { data: leaves = [] } = useApiListQuery<any>({
    queryKey: hrKeys.leavesPayrollForm(cid),
    queryFn: () => getLeaves(cid),
    fallbackMessage: 'فشل تحميل الإجازات',
    enabled: !!cid,
  });

  const { data: leaveSalarySettlements = [] } = useApiListQuery<any>({
    queryKey: hrKeys.leaveSalarySettlementsForMonth(cid, payrollMonth),
    queryFn: () => getLeaveSalarySettlements(cid, payrollMonth || defaultMonth),
    fallbackMessage: 'فشل تحميل تسويات رواتب الإجازات',
    enabled: !!cid && !!payrollMonth,
  });

  return {
    cid,
    isEditMode,
    defaultMonth,
    payrollMonth,
    setPayrollMonth,
    notes,
    setNotes,
    items,
    setItems,
    submitting,
    setSubmitting,
    error,
    setError,
    employees,
    existingRuns,
    editingRun,
    isLoadingRun,
    monthStr,
    compensationSnapshotByEmployeeId,
    compensationSnapshotsLoading,
    compensationSnapshotsError,
    advances,
    leaves,
    leaveSalarySettlements,
    runId,
  };
}

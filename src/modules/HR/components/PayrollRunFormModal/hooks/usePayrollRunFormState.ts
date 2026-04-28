import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  getEmployees,
  getInvoices,
  getLeaves,
  getPayrollRun,
  getPayrollRuns,
  getLeaveSalarySettlements,
  throwIfApiFailed,
} from '../../../../../services/api';
import { useCustomAllowances } from '../../../../../hooks/useCustomAllowances';
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

  const { data: employees = [] } = useQuery({
    queryKey: employeeKeys.list(cid, false),
    queryFn: async () => {
      const res = await getEmployees(cid, false);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!cid,
  });

  const { data: existingRuns = [] } = useQuery({
    queryKey: hrKeys.payrollRuns(cid, new Date(payrollMonth).getFullYear()),
    queryFn: async () => {
      const res = await getPayrollRuns(cid, new Date(payrollMonth).getFullYear());
      if (!res?.success) return [];
      const raw = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      return raw;
    },
    enabled: !!cid && !!payrollMonth,
  });

  const { data: editingRun, isLoading: isLoadingRun } = useQuery({
    queryKey: hrKeys.payrollRun(runId, cid),
    queryFn: async () => {
      const res = await getPayrollRun(runId as string, cid);
      throwIfApiFailed(res, 'فشل تحميل المسيرة');
      return res.data;
    },
    enabled: !!cid && !!runId,
  });

  const monthStart = payrollMonth ? new Date(payrollMonth) : null;
  const monthStr = monthStart ? `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}` : '';

  const { allowances: allCustomAllowances = [] } = useCustomAllowances(cid);

  const { data: advances = [] } = useQuery({
    queryKey: invoiceKeys.advancesForMonth(cid, monthStr),
    queryFn: async () => {
      const res = await getInvoices(cid, undefined, undefined, 1, 1000, null, null, 'advance');
      if (!res?.success) return [];
      return res.data?.items ?? [];
    },
    enabled: !!cid,
  });

  const { data: leaves = [] } = useQuery({
    queryKey: hrKeys.leavesPayrollForm(cid),
    queryFn: async () => {
      const res = await getLeaves(cid);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    },
    enabled: !!cid,
  });

  const { data: leaveSalarySettlements = [] } = useQuery({
    queryKey: hrKeys.leaveSalarySettlementsForMonth(cid, payrollMonth),
    queryFn: async () => {
      const res = await getLeaveSalarySettlements(cid, payrollMonth || defaultMonth);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
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
    allCustomAllowances,
    advances,
    leaves,
    leaveSalarySettlements,
    runId,
  };
}

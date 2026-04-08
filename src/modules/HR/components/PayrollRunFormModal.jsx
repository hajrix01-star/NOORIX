/**
 * PayrollRunFormModal — إنشاء/تعديل مسيرة راتب
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { getEmployees, getInvoices, getLeaves } from '../../../services/api';
import { getPayrollRun, getPayrollRuns } from '../../../services/api';
import { createPayrollRun, updatePayrollRun } from '../../../services/api';
import { hrFmt } from '../utils/hrFmt';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { useCustomAllowances } from '../../../hooks/useCustomAllowances';
import { parseOvertimeWorkDaysPerMonth, totalSalary } from '../utils/employeeSalaryMath';
import {
  filterLeaveDaySetToEmploymentWindow,
  getEmploymentProrationInMonth,
  toLocalDayKey,
} from '../utils/payrollAttendanceMath';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { roundMoney2 } from '../../../utils/moneyInput';
import { Button, AdaptiveSheet, Input, cn } from '../../../ui';

function parseDeferredMonth(notes) {
  const m = String(notes || '').match(/\[ADV_DEFER\]\s*(\d{4}-\d{2})/);
  return m ? m[1] : '';
}

function extractAdvanceDates(notes) {
  return String(notes || '').replace('تواريخ السلف:', '').trim();
}

function getDefaultPayrollMonth() {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() - 1);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-01`;
}

function monthRange(dateStr) {
  const start = new Date(dateStr);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function ceilAmount(value) {
  return Math.max(0, Math.ceil(Number(value) || 0));
}

export function PayrollRunFormModal({ companyId, runId = null, onCreate, onClose }) {
  const { t, lang } = useTranslation();
  const { activeCompanyId } = useApp();
  const cid = companyId || activeCompanyId || '';
  const isEditMode = !!runId;

  const defaultMonth = getDefaultPayrollMonth();

  const [payrollMonth, setPayrollMonth] = useState(defaultMonth);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', cid, false],
    queryFn: async () => {
      const res = await getEmployees(cid, false);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!cid,
  });

  const { data: existingRuns = [] } = useQuery({
    queryKey: ['payroll-runs', cid, new Date(payrollMonth).getFullYear()],
    queryFn: async () => {
      const res = await getPayrollRuns(cid, new Date(payrollMonth).getFullYear());
      if (!res?.success) return [];
      const raw = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      return raw;
    },
    enabled: !!cid && !!payrollMonth,
  });

  const { data: editingRun, isLoading: isLoadingRun } = useQuery({
    queryKey: ['payroll-run', runId, cid],
    queryFn: async () => {
      const res = await getPayrollRun(runId, cid);
      if (!res?.success) throw new Error(res?.error || 'فشل تحميل المسيرة');
      return res.data;
    },
    enabled: !!cid && !!runId,
  });

  const monthStart = payrollMonth ? new Date(payrollMonth) : null;
  const monthStr = monthStart ? `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}` : '';

  const { allowances: allCustomAllowances = [] } = useCustomAllowances(cid);

  const allowanceTotals = useMemo(() => {
    const map = new Map();
    for (const row of allCustomAllowances) {
      if (!row.employeeId) continue;
      map.set(row.employeeId, (map.get(row.employeeId) || 0) + (Number(row.amount) || 0));
    }
    return map;
  }, [allCustomAllowances]);

  const { data: advances = [] } = useQuery({
    queryKey: ['invoices', cid, 'advance', monthStr],
    queryFn: async () => {
      const res = await getInvoices(cid, null, null, 1, 1000, null, null, 'advance');
      if (!res?.success) return [];
      return res.data?.items ?? [];
    },
    enabled: !!cid,
  });

  const { data: leaves = [] } = useQuery({
    queryKey: ['leaves', cid, 'payroll-form'],
    queryFn: async () => {
      const res = await getLeaves(cid);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    },
    enabled: !!cid,
  });

  const existingMonthSet = useMemo(() => {
    const set = new Set();
    (existingRuns || []).forEach((r) => {
      if (runId && r.id === runId) return;
      const m = r.payrollMonth ? new Date(r.payrollMonth) : null;
      if (m) set.add(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
    });
    return set;
  }, [existingRuns, runId]);

  const alreadyExists = monthStr && existingMonthSet.has(monthStr);

  const activeEmployees = useMemo(() => {
    return (employees || []).filter((e) => e.status !== 'terminated' && e.status !== 'archived');
  }, [employees]);

  /** أيام الإجازة غير المدفوعة المعتمدة فقط (تُخصم من الراتب) */
  const unpaidLeaveDaysByEmployee = useMemo(() => {
    const { start, end } = monthRange(payrollMonth || defaultMonth);
    const map = new Map();
    for (const leave of leaves || []) {
      if (!leave?.employeeId || leave.status !== 'approved') continue;
      if (leave.leaveType !== 'unpaid') continue;
      const overlapStart = new Date(Math.max(new Date(leave.startDate).getTime(), start.getTime()));
      const overlapEnd = new Date(Math.min(new Date(leave.endDate).getTime(), end.getTime()));
      if (overlapStart > overlapEnd) continue;
      const days = map.get(leave.employeeId) || new Set();
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
  }, [leaves, payrollMonth, defaultMonth]);

  const eligibleEmployees = useMemo(() => {
    const pm = payrollMonth || defaultMonth;
    return activeEmployees.filter((e) => getEmploymentProrationInMonth(e, pm).factor > 0);
  }, [activeEmployees, payrollMonth, defaultMonth]);

  const displayEmployees = useMemo(() => {
    const map = new Map();
    eligibleEmployees.forEach((emp) => map.set(emp.id, emp));
    items.forEach((item) => {
      if (!item.employeeId || map.has(item.employeeId)) return;
      const fromList = (employees || []).find((e) => e.id === item.employeeId);
      map.set(item.employeeId, fromList || { id: item.employeeId, name: item.employeeName, nameAr: item.employeeName });
    });
    return Array.from(map.values());
  }, [eligibleEmployees, items, employees]);

  const advancesByEmployee = useMemo(() => {
    const map = new Map();
    for (const inv of advances || []) {
      if (!inv?.employeeId || inv?.status === 'cancelled') continue;
      const total = Number(inv.totalAmount ?? 0);
      const settled = Number(inv.settledAmount ?? 0);
      const remaining = Math.max(0, total - settled);
      if (remaining <= 0) continue;
      const deferMonth = parseDeferredMonth(inv.notes);
      const isDeferred = !!deferMonth && deferMonth > monthStr;
      const row = {
        id: inv.id,
        transactionDate: inv.transactionDate,
        remaining,
        isDeferred,
      };
      if (!map.has(inv.employeeId)) map.set(inv.employeeId, []);
      map.get(inv.employeeId).push(row);
    }
    return map;
  }, [advances, monthStr]);

  function getAdvanceMetaForEmployee(empId) {
    const rows = advancesByEmployee.get(empId) || [];
    const dueRows = rows.filter((r) => !r.isDeferred);
    const dueAmount = dueRows.reduce((s, r) => s + r.remaining, 0);
    const datesLabel = dueRows.map((r) => formatSaudiDate(r.transactionDate)).join(' ، ');
    return {
      dueAmount,
      datesLabel,
    };
  }

  const buildLineForEmployee = React.useCallback(
    (emp) => {
      const customSum = allowanceTotals.get(emp.id) || 0;
      const fullGross = totalSalary(emp, customSum);
      const pr = getEmploymentProrationInMonth(emp, payrollMonth || defaultMonth);
      const grossProrated = roundMoney2(fullGross * pr.factor);
      const rawUnpaid = unpaidLeaveDaysByEmployee.get(emp.id) || new Set();
      const unpaidInWindow = filterLeaveDaySetToEmploymentWindow(
        rawUnpaid,
        pr.effectiveStart,
        pr.effectiveEnd,
      );
      const unpaidDays = unpaidInWindow.size;
      const workDays = Math.max(1, parseOvertimeWorkDaysPerMonth(emp));
      const appliedUnpaid = Math.min(unpaidDays, workDays);
      const leaveDeduction = appliedUnpaid
        ? Math.min(grossProrated, ceilAmount((grossProrated * appliedUnpaid) / workDays))
        : 0;
      const advRows = advancesByEmployee.get(emp.id) || [];
      const dueAdv = advRows.filter((r) => !r.isDeferred);
      const advancesDeduct = dueAdv.reduce((s, r) => s + r.remaining, 0);
      const advanceDatesLabel = dueAdv.map((r) => formatSaudiDate(r.transactionDate)).join(' ، ');
      const netSalary = Math.max(0, grossProrated - leaveDeduction - advancesDeduct);
      const notesParts = [];
      if (advanceDatesLabel) notesParts.push(`تواريخ السلف: ${advanceDatesLabel}`);
      if (pr.factor < 1 && pr.daysInMonth > 0) {
        notesParts.push(t('payrollEmploymentProrationNote', String(pr.employedDays), String(pr.daysInMonth)));
      }
      if (appliedUnpaid > 0) {
        notesParts.push(t('payrollUnpaidLeaveDeductionNote', String(appliedUnpaid), hrFmt(leaveDeduction)));
      }
      return {
        employeeId: emp.id,
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
    },
    [payrollMonth, defaultMonth, allowanceTotals, unpaidLeaveDaysByEmployee, advancesByEmployee, lang, t],
  );

  const initItems = () => {
    setItems(eligibleEmployees.map(buildLineForEmployee));
  };

  const loadEditingItems = React.useCallback(() => {
    if (!editingRun) return;
    const loadedMonth = editingRun.payrollMonth ? `${String(editingRun.payrollMonth).slice(0, 10)}` : defaultMonth;
    setPayrollMonth(loadedMonth);
    setNotes(editingRun.notes || '');
    const loadedItems = (editingRun.items || []).map((row) => {
      const employeeId = row.employeeId || row.employee?.id || '';
      const employeeName = employeeDisplayName(row.employee || { name: row.employeeName }, lang);
      const advanceDates = extractAdvanceDates(row.notes);
      const advancesDeduct = Number(row.advancesDeduct ?? 0);
      return {
        employeeId,
        employeeName,
        grossSalary: Number(row.grossSalary ?? 0),
        allowancesAdd: Number(row.allowancesAdd ?? 0),
        deductions: Number(row.deductions ?? 0),
        advancesDeduct,
        netSalary: Number(row.netSalary ?? 0),
        deferAdvances: advancesDeduct <= 0 && !!parseDeferredMonth(row.notes),
        advanceDates,
        notes: row.notes || '',
      };
    });
    setItems(loadedItems);
  }, [defaultMonth, editingRun, lang]);

  React.useEffect(() => {
    if (isEditMode) return;
    if (eligibleEmployees.length > 0 && (items.length === 0 || monthStr)) {
      initItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eligibleEmployees.length, monthStr, advancesByEmployee, allowanceTotals, unpaidLeaveDaysByEmployee, isEditMode, buildLineForEmployee]);

  React.useEffect(() => {
    if (!isEditMode || !editingRun) return;
    loadEditingItems();
  }, [isEditMode, editingRun, loadEditingItems]);

  const updateItem = (idx, field, value) => {
    const num = parseFloat(value) || 0;
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: num };
      const g = next[idx].grossSalary ?? 0;
      const add = next[idx].allowancesAdd ?? 0;
      const ded = next[idx].deductions ?? 0;
      const adv = next[idx].advancesDeduct ?? 0;
      next[idx].netSalary = Math.max(0, g + add - ded - adv);
      return next;
    });
  };

  const toggleDefer = (idx) => {
    setItems((prev) => {
      const next = [...prev];
      const row = { ...next[idx] };
      row.deferAdvances = !row.deferAdvances;
      if (row.deferAdvances) {
        row.advancesDeduct = 0;
      } else {
        const advMeta = getAdvanceMetaForEmployee(row.employeeId);
        row.advancesDeduct = Number(advMeta.dueAmount || 0);
      }
      const g = row.grossSalary ?? 0;
      const add = row.allowancesAdd ?? 0;
      const ded = row.deductions ?? 0;
      const adv = row.advancesDeduct ?? 0;
      row.netSalary = Math.max(0, g + add - ded - adv);
      next[idx] = row;
      return next;
    });
  };

  const toggleInclude = (emp) => {
    const idx = items.findIndex((i) => i.employeeId === emp.id);
    if (idx >= 0) {
      setItems((prev) => prev.filter((_, i) => i !== idx));
    } else {
      const resolved = (employees || []).find((e) => e.id === emp.id) || emp;
      setItems((prev) => [...prev, buildLineForEmployee(resolved)]);
    }
  };

  const isIncluded = (empId) => items.some((i) => i.employeeId === empId);

  const handleSubmit = async (e) => {
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
      const payload = isEditMode ? {
        payrollMonth: `${payrollMonth}T00:00:00.000Z`,
        items: itemsPayload,
        notes: notes || undefined,
      } : {
        companyId: cid,
        payrollMonth: `${payrollMonth}T00:00:00.000Z`,
        items: itemsPayload,
        notes: notes || undefined,
      };
      const res = isEditMode
        ? await updatePayrollRun(runId, cid, payload)
        : await createPayrollRun(payload);
      if (!res?.success) throw new Error(res?.error || (isEditMode ? 'فشل تعديل المسيرة' : 'فشل إنشاء المسيرة'));
      onCreate?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || t('saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const totalNet = items.reduce((s, i) => s + (i.netSalary ?? 0), 0);

  const selectInput = (e) => {
    try {
      e.target.select();
    } catch {
      /* ignore */
    }
  };

  const modalTitle = isEditMode ? `${t('edit')} ${t('hrTabPayroll')}` : t('createPayrollRun');
  const primaryLabel = submitting
    ? t('saving')
    : (isEditMode ? (t('save') || 'حفظ') : (t('create') || 'إنشاء'));

  if (isEditMode && isLoadingRun) {
    return (
      <AdaptiveSheet open={true} onClose={onClose} title={t('loading')} size="sm" side="start">
        {t('loading')}
      </AdaptiveSheet>
    );
  }

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={modalTitle}
      size="full"
      side="start"
      className="payroll-run-form-drawer"
      footer={
        <>
          <div className="font-extrabold nx-font-numbers text-[clamp(15px,2.4vw,17px)]">
            {t('payrollTotal')}: {hrFmt(totalNet)}
          </div>
          <div className="flex gap-2.5 flex flex-wrap">
            <Button variant="ghost" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={submitting || items.length === 0 || alreadyExists}
              className="font-bold min-w-[120px]"
            >
              {primaryLabel}
            </Button>
          </div>
        </>
      }
    >
      <form className="prfm-modal-form" onSubmit={handleSubmit}>
        <div className="pt-1 pb-2 shrink-0">
          <p className="text-[12px] text-noorix-muted m-0 mb-2 leading-snug max-w-[85ch]">
            {t('payrollGrossFixedPackageHint')}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-[12px] font-semibold text-noorix-muted mb-1.5 block">{t('payrollMonth')}</label>
              <Input
                type="month"
                className="prfm-modal-field"
                value={payrollMonth ? payrollMonth.slice(0, 7) : ''}
                onChange={(e) => setPayrollMonth(e.target.value ? `${e.target.value}-01` : defaultMonth)}
              />
              {alreadyExists && (
                <span className="text-[12px] font-semibold mt-1.5 block text-noorix-amber">
                  {t('payrollMonthExists') || 'مسيرة لهذا الشهر موجودة'}
                </span>
              )}
            </div>
            <div>
              <label className="text-[12px] font-semibold text-noorix-muted mb-1.5 block">{t('notes')}</label>
              <Input
                type="text"
                className="prfm-modal-field"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notes')}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap pt-2 pb-1.5 shrink-0">
          <span className="text-[13px] font-bold">{t('employeesList')} ({items.length})</span>
          <Button type="button" size="sm" onClick={isEditMode ? loadEditingItems : initItems}>
            {t('refresh') || 'تحديث'}
          </Button>
        </div>

        <div className="prfm-modal-scroll min-w-0">
          <table className="payroll-run-table">
            <thead>
              <tr>
                <th className="w-[24%] min-w-0">{t('employeeName')}</th>
                <th className="w-[11%] min-w-0">{t('payrollAdvanceDates')}</th>
                <th className="w-[10%] min-w-0">{t('grossSalary')}</th>
                <th className="w-[9%] min-w-0">{t('payrollAllowances')}</th>
                <th className="w-[9%] min-w-0">{t('payrollDeductions')}</th>
                <th className="w-[9%] min-w-0">{t('payrollAdvances')}</th>
                <th className="w-[10%] min-w-0 text-center">{t('payrollDeferAdvanceDeduct')}</th>
                <th className="w-[10%] min-w-0">{t('netSalary')}</th>
              </tr>
            </thead>
            <tbody>
              {displayEmployees.map((emp) => {
                const idx = items.findIndex((i) => i.employeeId === emp.id);
                const included = idx >= 0;
                return (
                  <tr key={emp.id}>
                    <td className="min-w-0">
                      <label className="nx-checkbox nx-checkbox--tight min-w-0">
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => toggleInclude(emp)}
                          aria-label={t('employeeName')}
                        />
                        <span
                          className={cn(
                            'min-w-0 truncate block',
                            included ? 'font-semibold' : 'font-normal',
                          )}
                          title={employeeDisplayName(emp, lang)}
                        >
                          {employeeDisplayName(emp, lang)}
                        </span>
                      </label>
                    </td>
                    {included ? (
                      <>
                        <td className="text-noorix-muted text-[11px] min-w-0 nx-line-145 align-top" title={items[idx].advanceDates || ''}>
                          <span className="line-clamp-2 break-words">{items[idx].advanceDates || '—'}</span>
                        </td>
                        <td className="font-semibold text-[12px] whitespace-nowrap nx-font-numbers text-end">{hrFmt(items[idx].grossSalary)}</td>
                        <td className="text-end">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step={1}
                            min={0}
                            size="sm"
                            className="max-w-[4.5rem] ms-auto tabular-nums !py-1 !px-2"
                            value={items[idx].allowancesAdd ?? 0}
                            onChange={(e) => updateItem(idx, 'allowancesAdd', e.target.value)}
                            onFocus={selectInput}
                            aria-label={t('payrollAllowances')}
                          />
                        </td>
                        <td className="text-end">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step={1}
                            min={0}
                            size="sm"
                            className="max-w-[4.5rem] ms-auto tabular-nums !py-1 !px-2"
                            value={items[idx].deductions ?? 0}
                            onChange={(e) => updateItem(idx, 'deductions', e.target.value)}
                            onFocus={selectInput}
                            aria-label={t('payrollDeductions')}
                          />
                        </td>
                        <td className="text-end">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step={1}
                            min={0}
                            size="sm"
                            className="max-w-[4.5rem] ms-auto tabular-nums !py-1 !px-2"
                            value={items[idx].advancesDeduct ?? 0}
                            onChange={(e) => updateItem(idx, 'advancesDeduct', e.target.value)}
                            disabled={items[idx].deferAdvances}
                            onFocus={selectInput}
                            aria-label={t('payrollAdvances')}
                          />
                        </td>
                        <td className="text-center px-1">
                          <label className="nx-checkbox nx-checkbox--cell-center inline-flex justify-center">
                            <input
                              type="checkbox"
                              checked={!!items[idx].deferAdvances}
                              onChange={() => toggleDefer(idx)}
                              aria-label={t('payrollDeferAdvanceDeduct')}
                            />
                          </label>
                        </td>
                        <td className="font-extrabold text-[12px] whitespace-nowrap nx-font-numbers text-end">{hrFmt(items[idx].netSalary)}</td>
                      </>
                    ) : (
                      <td colSpan={7} className="text-noorix-muted text-[13px]">
                        —
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {error && (
          <div
            className="text-[13px] font-semibold mt-3 rounded-lg p-3 shrink-0 bg-noorix-red/15 border border-noorix-red/25 text-noorix-red"
            role="alert"
          >
            {error}
          </div>
        )}
      </form>
    </AdaptiveSheet>
  );
}

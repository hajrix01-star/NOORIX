/**
 * PayrollRunFormModal — إنشاء/تعديل مسيرة راتب
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { getEmployees, getInvoices } from '../../../services/api';
import { getPayrollRun, getPayrollRuns } from '../../../services/api';
import { createPayrollRun, updatePayrollRun } from '../../../services/api';
import { hrFmt } from '../utils/hrFmt';
import { formatSaudiDate } from '../../../utils/saudiDate';
import { useCustomAllowances } from '../../../hooks/useCustomAllowances';
import { totalSalary } from '../utils/employeeSalaryMath';

function parseDeferredMonth(notes) {
  const m = String(notes || '').match(/\[ADV_DEFER\]\s*(\d{4}-\d{2})/);
  return m ? m[1] : '';
}

function extractAdvanceDates(notes) {
  return String(notes || '').replace('تواريخ السلف:', '').trim();
}

export function PayrollRunFormModal({ companyId, runId = null, onCreate, onClose }) {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();
  const cid = companyId || activeCompanyId || '';
  const isEditMode = !!runId;

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;

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

  const displayEmployees = useMemo(() => {
    const map = new Map();
    activeEmployees.forEach((emp) => map.set(emp.id, emp));
    items.forEach((item) => {
      if (!item.employeeId || map.has(item.employeeId)) return;
      map.set(item.employeeId, { id: item.employeeId, name: item.employeeName, nameAr: item.employeeName });
    });
    return Array.from(map.values());
  }, [activeEmployees, items]);

  const advancesByEmployee = useMemo(() => {
    const map = new Map();
    for (const inv of advances || []) {
      if (!inv?.employeeId || inv?.status === 'cancelled') continue;
      const total = Number(inv.totalAmount ?? 0);
      const settled = Number(inv.settledAmount ?? 0);
      const remaining = Math.max(0, total - settled);
      if (remaining <= 0) continue;
      const deferMonth = parseDeferredMonth(inv.notes);
      const isDeferred = deferMonth && deferMonth === monthStr;
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

  const initItems = () => {
    const list = activeEmployees.map((emp) => {
      const customSum = allowanceTotals.get(emp.id) || 0;
      const gross = totalSalary(emp, customSum);
      const advMeta = getAdvanceMetaForEmployee(emp.id);
      const advancesDeduct = Number(advMeta.dueAmount || 0);
      const baseBeforeDeduction = gross;
      const deductions = 0;
      const netSalary = Math.max(0, baseBeforeDeduction - deductions - advancesDeduct);
      return {
        employeeId: emp.id,
        employeeName: emp.name || emp.nameAr || '—',
        grossSalary: gross,
        allowancesAdd: 0,
        deductions,
        advancesDeduct,
        netSalary,
        deferAdvances: false,
        advanceDates: advMeta.datesLabel,
        notes: advMeta.datesLabel ? `تواريخ السلف: ${advMeta.datesLabel}` : '',
      };
    });
    setItems(list);
  };

  const loadEditingItems = React.useCallback(() => {
    if (!editingRun) return;
    const loadedMonth = editingRun.payrollMonth ? `${String(editingRun.payrollMonth).slice(0, 10)}` : defaultMonth;
    setPayrollMonth(loadedMonth);
    setNotes(editingRun.notes || '');
    const loadedItems = (editingRun.items || []).map((row) => {
      const employeeId = row.employeeId || row.employee?.id || '';
      const employeeName = row.employee?.name || row.employee?.nameAr || row.employeeName || '—';
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
  }, [defaultMonth, editingRun]);

  React.useEffect(() => {
    if (isEditMode) return;
    if (activeEmployees.length > 0 && (items.length === 0 || monthStr)) {
      initItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmployees.length, monthStr, advancesByEmployee, allowanceTotals, isEditMode]);

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
      const customSum = allowanceTotals.get(emp.id) || 0;
      const gross = totalSalary(emp, customSum);
      const advMeta = getAdvanceMetaForEmployee(emp.id);
      const advancesDeduct = Number(advMeta.dueAmount || 0);
      setItems((prev) => [...prev, {
        employeeId: emp.id,
        employeeName: emp.name || emp.nameAr || '—',
        grossSalary: gross,
        allowancesAdd: 0,
        deductions: 0,
        advancesDeduct,
        netSalary: Math.max(0, gross - advancesDeduct),
        deferAdvances: false,
        advanceDates: advMeta.datesLabel,
        notes: advMeta.datesLabel ? `تواريخ السلف: ${advMeta.datesLabel}` : '',
      }]);
    }
  };

  const isIncluded = (empId) => items.some((i) => i.employeeId === empId);

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      <div
        className="modal-overlay"
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 12 }}
        onClick={onClose}
      >
        <div className="noorix-surface-card" style={{ padding: 24, minWidth: 320 }} onClick={(e) => e.stopPropagation()}>
          {t('loading')}
        </div>
      </div>
    );
  }

  return (
    <div
      className="modal-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 12 }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="noorix-surface-card prfm-modal-root"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="prfm-modal-title"
        aria-modal="true"
      >
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--noorix-border)', flexShrink: 0 }}>
          <h3 id="prfm-modal-title" style={{ margin: 0, fontSize: 19, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {modalTitle}
          </h3>
          <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--noorix-text-muted)', lineHeight: 1.6, maxWidth: '72ch' }}>
            {t('payrollGrossFixedPackageHint')}
          </p>
        </div>

        <form className="prfm-modal-form" onSubmit={handleSubmit}>
          <div style={{ padding: '16px 24px 0', flexShrink: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--noorix-text-muted)' }}>{t('payrollMonth')}</label>
                <input
                  type="month"
                  className="prfm-modal-field"
                  value={payrollMonth ? payrollMonth.slice(0, 7) : ''}
                  onChange={(e) => setPayrollMonth(e.target.value ? `${e.target.value}-01` : defaultMonth)}
                />
                {alreadyExists && (
                  <span style={{ fontSize: 12, color: 'var(--noorix-accent-amber)', marginTop: 6, display: 'block', fontWeight: 600 }}>
                    {t('payrollMonthExists') || 'مسيرة لهذا الشهر موجودة'}
                  </span>
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--noorix-text-muted)' }}>{t('notes')}</label>
                <input
                  type="text"
                  className="prfm-modal-field"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t('notes')}
                />
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '14px 24px 10px',
              flexShrink: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700 }}>{t('employeesList')} ({items.length})</span>
            <button type="button" className="noorix-btn-nav" onClick={isEditMode ? loadEditingItems : initItems}>
              {t('refresh') || 'تحديث'}
            </button>
          </div>

          <div className="prfm-modal-scroll" style={{ margin: '0 24px' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ minWidth: 200 }}>{t('employeeName')}</th>
                  <th>{t('payrollAdvanceDates')}</th>
                  <th>{t('grossSalary')}</th>
                  <th>{t('payrollAllowances')}</th>
                  <th>{t('payrollDeductions')}</th>
                  <th>{t('payrollAdvances')}</th>
                  <th style={{ textAlign: 'center' }}>{t('payrollDeferAdvanceDeduct')}</th>
                  <th>{t('netSalary')}</th>
                </tr>
              </thead>
              <tbody>
                {displayEmployees.map((emp) => {
                  const idx = items.findIndex((i) => i.employeeId === emp.id);
                  const included = idx >= 0;
                  return (
                    <tr key={emp.id}>
                      <td>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', lineHeight: 1.45 }}>
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={() => toggleInclude(emp)}
                            style={{ width: 18, height: 18, marginTop: 2, flexShrink: 0 }}
                            aria-label={t('employeeName')}
                          />
                          <span style={{ fontWeight: included ? 600 : 400 }}>{emp.name || emp.nameAr || '—'}</span>
                        </label>
                      </td>
                      {included ? (
                        <>
                          <td style={{ color: 'var(--noorix-text-muted)', fontSize: 12, maxWidth: 160, lineHeight: 1.45 }} title={items[idx].advanceDates || ''}>
                            {items[idx].advanceDates || '—'}
                          </td>
                          <td style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>{hrFmt(items[idx].grossSalary)}</td>
                          <td>
                            <input
                              type="number"
                              inputMode="decimal"
                              step={1}
                              min={0}
                              className="prfm-modal-num"
                              value={items[idx].allowancesAdd ?? 0}
                              onChange={(e) => updateItem(idx, 'allowancesAdd', e.target.value)}
                              onFocus={selectInput}
                              aria-label={t('payrollAllowances')}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              inputMode="decimal"
                              step={1}
                              min={0}
                              className="prfm-modal-num"
                              value={items[idx].deductions ?? 0}
                              onChange={(e) => updateItem(idx, 'deductions', e.target.value)}
                              onFocus={selectInput}
                              aria-label={t('payrollDeductions')}
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              inputMode="decimal"
                              step={1}
                              min={0}
                              className="prfm-modal-num"
                              value={items[idx].advancesDeduct ?? 0}
                              onChange={(e) => updateItem(idx, 'advancesDeduct', e.target.value)}
                              disabled={items[idx].deferAdvances}
                              onFocus={selectInput}
                              aria-label={t('payrollAdvances')}
                            />
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', padding: '6px 4px' }}>
                              <input
                                type="checkbox"
                                checked={!!items[idx].deferAdvances}
                                onChange={() => toggleDefer(idx)}
                                style={{ width: 18, height: 18 }}
                                aria-label={t('payrollDeferAdvanceDeduct')}
                              />
                            </label>
                          </td>
                          <td style={{ fontFamily: 'var(--noorix-font-numbers)', fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap' }}>{hrFmt(items[idx].netSalary)}</td>
                        </>
                      ) : (
                        <td colSpan={7} style={{ color: 'var(--noorix-text-muted)', fontSize: 13 }}>
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
              style={{
                margin: '12px 24px 0',
                padding: '12px 14px',
                background: 'rgba(239,68,68,0.12)',
                borderRadius: 10,
                border: '1px solid rgba(239,68,68,0.25)',
                color: 'var(--noorix-accent-red)',
                fontSize: 13,
                fontWeight: 600,
                flexShrink: 0,
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="prfm-modal-footer" style={{ marginTop: 'auto' }}>
            <div style={{ fontWeight: 800, fontSize: 'clamp(15px, 2.4vw, 17px)', fontFamily: 'var(--noorix-font-numbers)' }}>
              {t('payrollTotal')}: {hrFmt(totalNet)}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="noorix-btn-nav" onClick={onClose}>
                {t('cancel')}
              </button>
              <button
                type="submit"
                className="noorix-btn-nav"
                style={{ background: 'var(--btn-primary-bg)', color: '#fff', minWidth: 120, fontWeight: 700 }}
                disabled={submitting || items.length === 0 || alreadyExists}
              >
                {primaryLabel}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

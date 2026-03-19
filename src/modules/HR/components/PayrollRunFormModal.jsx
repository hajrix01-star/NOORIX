/**
 * PayrollRunFormModal — إنشاء مسيرة راتب جديدة
 */
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../i18n/useTranslation';
import { useApp } from '../../../context/AppContext';
import { getEmployees, getInvoices } from '../../../services/api';
import { getPayrollRuns } from '../../../services/api';
import { createPayrollRun } from '../../../services/api';
import { fmt } from '../../../utils/format';
import { formatSaudiDate } from '../../../utils/saudiDate';
import Decimal from 'decimal.js';

function totalSalary(emp) {
  const basic = new Decimal(emp.basicSalary ?? 0);
  const housing = new Decimal(emp.housingAllowance ?? 0);
  const transport = new Decimal(emp.transportAllowance ?? 0);
  const other = new Decimal(emp.otherAllowance ?? 0);
  return basic.plus(housing).plus(transport).plus(other).toNumber();
}

function parseDeferredMonth(notes) {
  const m = String(notes || '').match(/\[ADV_DEFER\]\s*(\d{4}-\d{2})/);
  return m ? m[1] : '';
}

export function PayrollRunFormModal({ companyId, onCreate, onClose }) {
  const { t } = useTranslation();
  const { activeCompanyId } = useApp();
  const cid = companyId || activeCompanyId || '';

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

  const monthStart = payrollMonth ? new Date(payrollMonth) : null;
  const monthStr = monthStart ? `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}` : '';

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
      const m = r.payrollMonth ? new Date(r.payrollMonth) : null;
      if (m) set.add(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`);
    });
    return set;
  }, [existingRuns]);

  const alreadyExists = monthStr && existingMonthSet.has(monthStr);

  const activeEmployees = useMemo(() => {
    return (employees || []).filter((e) => e.status !== 'terminated' && e.status !== 'archived');
  }, [employees]);

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
      const gross = totalSalary(emp);
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

  React.useEffect(() => {
    if (activeEmployees.length > 0 && (items.length === 0 || monthStr)) {
      initItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEmployees.length, monthStr, advancesByEmployee]);

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
      const gross = totalSalary(emp);
      setItems((prev) => [...prev, {
        employeeId: emp.id,
        employeeName: emp.name || emp.nameAr || '—',
        grossSalary: gross,
        allowancesAdd: 0,
        deductions: 0,
        advancesDeduct: 0,
        netSalary: gross,
        notes: '',
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
      const payload = {
        companyId: cid,
        payrollMonth: `${payrollMonth}T00:00:00.000Z`,
        items: items.map((i) => ({
          employeeId: i.employeeId,
          grossSalary: i.grossSalary,
          allowancesAdd: i.allowancesAdd,
          deductions: i.deductions,
          advancesDeduct: i.advancesDeduct,
          netSalary: i.netSalary,
          notes: i.notes || undefined,
        })),
        notes: notes || undefined,
      };
      const res = await createPayrollRun(payload);
      if (!res?.success) throw new Error(res?.error || 'فشل إنشاء المسيرة');
      onCreate?.();
      onClose?.();
    } catch (err) {
      setError(err?.message || t('saveFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const totalNet = items.reduce((s, i) => s + (i.netSalary ?? 0), 0);

  return (
    <div
      className="modal-overlay"
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}
      onClick={onClose}
    >
      <div
        className="noorix-surface-card"
        style={{ padding: 24, maxWidth: 720, width: '95%', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{t('createPayrollRun')}</h3>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('payrollMonth')}</label>
              <input
                type="month"
                value={payrollMonth ? payrollMonth.slice(0, 7) : ''}
                onChange={(e) => setPayrollMonth(e.target.value ? `${e.target.value}-01` : defaultMonth)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
              />
              {alreadyExists && (
                <span style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, display: 'block' }}>
                  {t('payrollMonthExists') || 'مسيرة لهذا الشهر موجودة'}
                </span>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 4 }}>{t('notes')}</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('notes')}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--noorix-border)' }}
              />
            </div>
          </div>

          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('employeesList')} ({items.length})</span>
            <button type="button" className="noorix-btn-nav" onClick={initItems}>
              {t('refresh') || 'تحديث'}
            </button>
          </div>

          <div className="noorix-table-frame" style={{ overflowX: 'auto', maxHeight: 280, border: '1px solid var(--noorix-border)', borderRadius: 8, marginBottom: 16 }}>
            <table className="noorix-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--noorix-bg-page)' }}>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid var(--noorix-border)' }}>{t('employeeName')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid var(--noorix-border)' }}>{t('payrollAdvanceDates')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid var(--noorix-border)' }}>{t('grossSalary')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid var(--noorix-border)' }}>{t('payrollAllowances')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid var(--noorix-border)' }}>{t('payrollDeductions')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid var(--noorix-border)' }}>{t('payrollAdvances')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid var(--noorix-border)' }}>{t('payrollDeferAdvanceDeduct')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right', borderBottom: '1px solid var(--noorix-border)' }}>{t('netSalary')}</th>
                  <th style={{ padding: '8px 10px', textAlign: 'center', borderBottom: '1px solid var(--noorix-border)' }}>—</th>
                </tr>
              </thead>
              <tbody>
                {activeEmployees.map((emp) => {
                  const idx = items.findIndex((i) => i.employeeId === emp.id);
                  const included = idx >= 0;
                  return (
                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--noorix-border)' }}>
                      <td style={{ padding: '6px 10px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={() => toggleInclude(emp)}
                          />
                          <span>{emp.name || emp.nameAr || '—'}</span>
                        </label>
                      </td>
                      {included ? (
                        <>
                          <td style={{ padding: '6px 10px', color: 'var(--noorix-text-muted)' }}>{items[idx].advanceDates || '—'}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--noorix-font-numbers)' }}>{fmt(items[idx].grossSalary)}</td>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={items[idx].allowancesAdd ?? 0}
                              onChange={(e) => updateItem(idx, 'allowancesAdd', e.target.value)}
                              style={{ width: 70, padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={items[idx].deductions ?? 0}
                              onChange={(e) => updateItem(idx, 'deductions', e.target.value)}
                              style={{ width: 70, padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px' }}>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={items[idx].advancesDeduct ?? 0}
                              onChange={(e) => updateItem(idx, 'advancesDeduct', e.target.value)}
                              disabled={items[idx].deferAdvances}
                              style={{ width: 70, padding: '4px 6px', fontSize: 12, textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                            <input type="checkbox" checked={!!items[idx].deferAdvances} onChange={() => toggleDefer(idx)} />
                          </td>
                          <td style={{ padding: '6px 10px', fontFamily: 'var(--noorix-font-numbers)', fontWeight: 600 }}>{fmt(items[idx].netSalary)}</td>
                        </>
                      ) : (
                        <>
                          <td colSpan={7} style={{ padding: '6px 10px', color: 'var(--noorix-text-muted)' }}>—</td>
                        </>
                      )}
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>—</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginBottom: 16, fontWeight: 700, fontSize: 15 }}>
            {t('payrollTotal')}: {fmt(totalNet)}
          </div>

          {error && (
            <div style={{ marginBottom: 12, padding: 10, background: 'rgba(239,68,68,0.1)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="noorix-btn-nav" onClick={onClose}>{t('cancel')}</button>
            <button
              type="submit"
              className="noorix-btn-nav"
              style={{ background: 'var(--btn-primary-bg)', color: '#fff' }}
              disabled={submitting || items.length === 0 || alreadyExists}
            >
              {submitting ? t('saving') : t('create') || 'إنشاء'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

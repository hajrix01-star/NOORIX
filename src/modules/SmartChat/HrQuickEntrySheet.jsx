/**
 * HrQuickEntrySheet — إدخال سريع من المحادثة (سلفة، إجازة، خصم، زيادة/بدلة)
 * واجهة مُحسّنة للجوال: شاشة كاملة تقريباً، حقول 16px، أزرار كبيرة، safe-area.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { getEmployees, createLeave, createDeduction, createMovement, createCustomAllowance } from '../../services/api';
import { createAdvance } from '../../services/financialApi';
import { useVaults } from '../../hooks/useVaults';
import { getSaudiToday } from '../../utils/saudiDate';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';

const TYPE_MAP = { annual: 'leaveAnnual', sick: 'leaveSick', unpaid: 'leaveUnpaid', other: 'leaveOther' };

const inp = {
  width: '100%',
  minHeight: 48,
  padding: '12px 14px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid var(--noorix-border)',
  background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)',
  boxSizing: 'border-box',
};

const lbl = { display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--noorix-text)' };

const block = { marginBottom: 16 };

function invalidateHrQueries(qc, companyId) {
  qc.invalidateQueries({ queryKey: ['employees', companyId] });
  qc.invalidateQueries({ queryKey: ['employees-paged', companyId] });
  qc.invalidateQueries({ queryKey: ['leaves', companyId] });
  qc.invalidateQueries({ queryKey: ['deductions', companyId] });
  qc.invalidateQueries({ queryKey: ['custom-allowances', companyId] });
}

/** @param {{ mode: string, companyId: string, onClose: () => void, onRecorded?: (o: { textAr: string, textEn: string }) => void }} props */
export function HrQuickEntrySheet({ mode, companyId, onClose, onRecorded }) {
  const { t, lang } = useTranslation();
  const qc = useQueryClient();
  const isAr = lang === 'ar';
  const { vaultsList } = useVaults({ companyId });
  const vaults = vaultsList || [];

  const { data: employees = [] } = useQuery({
    queryKey: ['employees', companyId, false],
    queryFn: async () => {
      const res = await getEmployees(companyId, false);
      if (!res?.success) return [];
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!companyId,
  });

  const activeEmployees = useMemo(
    () => (employees || []).filter((e) => e.status !== 'terminated' && e.status !== 'archived'),
    [employees],
  );

  /* ——— Advance ——— */
  const [advEmp, setAdvEmp] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advVault, setAdvVault] = useState('');
  const [advDate, setAdvDate] = useState(getSaudiToday());
  const [advNotes, setAdvNotes] = useState('');

  /* ——— Leave ——— */
  const [lvEmp, setLvEmp] = useState('');
  const [lvType, setLvType] = useState('annual');
  const [lvStart, setLvStart] = useState('');
  const [lvEnd, setLvEnd] = useState('');
  const [lvDays, setLvDays] = useState('');
  const [lvNotes, setLvNotes] = useState('');

  /* ——— Deduction ——— */
  const [ddEmp, setDdEmp] = useState('');
  const [ddType, setDdType] = useState('penalty');
  const [ddAmount, setDdAmount] = useState('');
  const [ddDate, setDdDate] = useState(getSaudiToday());
  const [ddNotes, setDdNotes] = useState('');

  /* ——— Increase: movement | allowance ——— */
  const [incTab, setIncTab] = useState('movement');
  const [mvEmp, setMvEmp] = useState('');
  const [mvType, setMvType] = useState('raise');
  const [mvAmount, setMvAmount] = useState('');
  const [mvPrev, setMvPrev] = useState('');
  const [mvNew, setMvNew] = useState('');
  const [mvEff, setMvEff] = useState(getSaudiToday());
  const [mvNotes, setMvNotes] = useState('');
  const [alEmp, setAlEmp] = useState('');
  const [alName, setAlName] = useState('');
  const [alAmount, setAlAmount] = useState('');

  const [formError, setFormError] = useState('');

  useEffect(() => {
    setFormError('');
  }, [mode]);

  useEffect(() => {
    if (vaults[0]?.id) setAdvVault((v) => v || vaults[0].id);
  }, [vaults]);

  const advMut = useMutation({
    mutationFn: async (payload) => {
      const res = await createAdvance(payload);
      if (!res?.success) throw new Error(res?.error || 'Request failed');
      return res;
    },
    onSuccess: () => {
      invalidateOnFinancialMutation(qc);
      invalidateHrQueries(qc, companyId);
      onRecorded?.({ textAr: 'تم تسجيل السلفة.', textEn: 'Advance recorded.' });
      onClose();
    },
    onError: (e) => setFormError(e?.message || String(e)),
  });

  const leaveMut = useMutation({
    mutationFn: async (body) => {
      const res = await createLeave(body);
      if (!res?.success) throw new Error(res?.error || 'Request failed');
      return res;
    },
    onSuccess: () => {
      invalidateHrQueries(qc, companyId);
      onRecorded?.({ textAr: 'تم تسجيل الإجازة.', textEn: 'Leave recorded.' });
      onClose();
    },
    onError: (e) => setFormError(e?.message || String(e)),
  });

  const dedMut = useMutation({
    mutationFn: async (body) => {
      const res = await createDeduction(body);
      if (!res?.success) throw new Error(res?.error || 'Request failed');
      return res;
    },
    onSuccess: () => {
      invalidateHrQueries(qc, companyId);
      onRecorded?.({ textAr: 'تم تسجيل الخصم.', textEn: 'Deduction recorded.' });
      onClose();
    },
    onError: (e) => setFormError(e?.message || String(e)),
  });

  const movMut = useMutation({
    mutationFn: async (body) => {
      const res = await createMovement(body);
      if (!res?.success) throw new Error(res?.error || 'Request failed');
      return res;
    },
    onSuccess: () => {
      invalidateHrQueries(qc, companyId);
      onRecorded?.({ textAr: 'تم تسجيل الزيادة أو الترقية.', textEn: 'Promotion or raise recorded.' });
      onClose();
    },
    onError: (e) => setFormError(e?.message || String(e)),
  });

  const alMut = useMutation({
    mutationFn: async (body) => {
      const res = await createCustomAllowance(body);
      if (!res?.success) throw new Error(res?.error || 'Request failed');
      return res;
    },
    onSuccess: () => {
      invalidateHrQueries(qc, companyId);
      onRecorded?.({ textAr: 'تم تسجيل البدلة الإضافية.', textEn: 'Allowance recorded.' });
      onClose();
    },
    onError: (e) => setFormError(e?.message || String(e)),
  });

  const submitting =
    advMut.isPending || leaveMut.isPending || dedMut.isPending || movMut.isPending || alMut.isPending;

  const title = useMemo(() => {
    if (mode === 'advance') return isAr ? t('payAdvance') : 'Pay advance';
    if (mode === 'leave') return isAr ? t('addLeave') : 'Add leave';
    if (mode === 'deduction') return isAr ? t('chatRecordDeduction') : 'Record deduction';
    if (mode === 'increase') return isAr ? t('chatRaiseOrAllowance') : 'Raise or allowance';
    return '';
  }, [mode, isAr, t]);

  const onSubmitAdvance = (e) => {
    e.preventDefault();
    setFormError('');
    const amt = parseFloat(advAmount, 10);
    const emp = activeEmployees.find((x) => x.id === advEmp);
    if (!advEmp || !advVault || !amt || amt <= 0) {
      setFormError(t('requiredFields'));
      return;
    }
    advMut.mutate({
      employeeId: advEmp,
      companyId,
      vaultId: advVault,
      amount: amt,
      transactionDate: advDate,
      notes: advNotes.trim() || `سلفة — ${emp?.name || emp?.nameAr || ''}`,
      employeeName: emp?.name || emp?.nameAr,
    });
  };

  const onSubmitLeave = (e) => {
    e.preventDefault();
    setFormError('');
    if (!lvEmp || !lvStart || !lvEnd) {
      setFormError(t('requiredFields'));
      return;
    }
    const s = new Date(lvStart);
    const end = new Date(lvEnd);
    if (end < s) {
      setFormError(t('endDateBeforeStart'));
      return;
    }
    leaveMut.mutate({
      companyId,
      employeeId: lvEmp,
      leaveType: lvType,
      startDate: `${lvStart}T00:00:00.000Z`,
      endDate: `${lvEnd}T00:00:00.000Z`,
      daysCount: lvDays ? parseInt(lvDays, 10) : undefined,
      status: 'pending',
      notes: lvNotes || undefined,
    });
  };

  const onSubmitDeduction = (e) => {
    e.preventDefault();
    setFormError('');
    const amt = parseFloat(ddAmount, 10);
    if (!ddEmp || !amt || amt <= 0) {
      setFormError(t('requiredFields'));
      return;
    }
    dedMut.mutate({
      companyId,
      employeeId: ddEmp,
      deductionType: ddType,
      amount: amt,
      transactionDate: `${ddDate}T12:00:00.000Z`,
      notes: ddNotes || undefined,
    });
  };

  const onSubmitMovement = (e) => {
    e.preventDefault();
    setFormError('');
    if (!mvEmp || !mvEff) {
      setFormError(t('requiredFields'));
      return;
    }
    const amt = mvAmount.trim() ? parseFloat(mvAmount, 10) : undefined;
    movMut.mutate({
      companyId,
      employeeId: mvEmp,
      movementType: mvType,
      amount: Number.isFinite(amt) ? amt : undefined,
      previousValue: mvPrev || undefined,
      newValue: mvNew || undefined,
      effectiveDate: `${mvEff}T12:00:00.000Z`,
      notes: mvNotes || undefined,
    });
  };

  const onSubmitAllowance = (e) => {
    e.preventDefault();
    setFormError('');
    const amt = parseFloat(alAmount, 10);
    if (!alEmp || !alName.trim() || !amt || amt <= 0) {
      setFormError(t('requiredFields'));
      return;
    }
    alMut.mutate({
      companyId,
      employeeId: alEmp,
      nameAr: alName.trim(),
      amount: amt,
    });
  };

  const empSelect = (value, onChange) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} required style={inp}>
      <option value="">{isAr ? '— اختر الموظف —' : '— Select employee —'}</option>
      {activeEmployees.map((emp) => (
        <option key={emp.id} value={emp.id}>{emp.name || emp.nameAr || '—'}</option>
      ))}
    </select>
  );

  const leaveDaysEffect = (start, end, setDays) => {
    if (!start || !end) return;
    const s = new Date(start);
    const e = new Date(end);
    if (e >= s) {
      const days = Math.ceil((e - s) / (86400000)) + 1;
      setDays(String(days));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1002,
        background: 'var(--noorix-bg, #f8fafc)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      <header
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '12px 16px',
          borderBottom: '1px solid var(--noorix-border)',
          background: 'var(--noorix-bg-surface)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800 }}>{title}</h2>
        <button
          type="button"
          className="noorix-btn-nav"
          onClick={onClose}
          style={{ minHeight: 44, minWidth: 44, padding: '10px 14px', fontSize: 15, touchAction: 'manipulation' }}
        >
          {isAr ? 'إغلاق' : 'Close'}
        </button>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          padding: 16,
          maxWidth: 520,
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        {formError && (
          <div style={{ marginBottom: 16, padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: '#b91c1c', fontSize: 14 }}>
            {formError}
          </div>
        )}

        {mode === 'advance' && (
          <form onSubmit={onSubmitAdvance}>
            <div style={block}>
              <label style={lbl}>{t('selectEmployee')}</label>
              {empSelect(advEmp, setAdvEmp)}
            </div>
            <div style={block}>
              <label style={lbl}>{t('advanceAmount')}</label>
              <input type="number" inputMode="decimal" step="0.01" min="0" value={advAmount} onChange={(e) => setAdvAmount(e.target.value)} style={inp} placeholder="0" />
            </div>
            <div style={block}>
              <label style={lbl}>{t('selectVault')}</label>
              <select value={advVault} onChange={(e) => setAdvVault(e.target.value)} style={inp}>
                {vaults.map((v) => (
                  <option key={v.id} value={v.id}>{v.nameAr || v.nameEn || v.id}</option>
                ))}
              </select>
            </div>
            <div style={block}>
              <label style={lbl}>{t('transactionDate')}</label>
              <input type="date" value={advDate} onChange={(e) => setAdvDate(e.target.value)} style={inp} />
            </div>
            <div style={block}>
              <label style={lbl}>{t('notes')}</label>
              <input type="text" value={advNotes} onChange={(e) => setAdvNotes(e.target.value)} style={inp} placeholder={isAr ? 'سبب أو تفاصيل' : 'Reason or details'} />
            </div>
            <button type="submit" className="noorix-btn-primary" disabled={submitting} style={{ width: '100%', minHeight: 52, fontSize: 16, fontWeight: 700, marginTop: 8, touchAction: 'manipulation' }}>
              {submitting ? t('saving') : t('payAdvance')}
            </button>
          </form>
        )}

        {mode === 'leave' && (
          <form onSubmit={onSubmitLeave}>
            <div style={block}>
              <label style={lbl}>{t('selectEmployee')}</label>
              {empSelect(lvEmp, setLvEmp)}
            </div>
            <div style={block}>
              <label style={lbl}>{t('leaveType')}</label>
              <select value={lvType} onChange={(e) => setLvType(e.target.value)} style={inp}>
                {Object.keys(TYPE_MAP).map((k) => (
                  <option key={k} value={k}>{t(TYPE_MAP[k])}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={lbl}>{t('startDate')}</label>
                <input
                  type="date"
                  value={lvStart}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLvStart(v);
                    leaveDaysEffect(v, lvEnd, setLvDays);
                  }}
                  style={inp}
                  required
                />
              </div>
              <div>
                <label style={lbl}>{t('endDate')}</label>
                <input
                  type="date"
                  value={lvEnd}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLvEnd(v);
                    leaveDaysEffect(lvStart, v, setLvDays);
                  }}
                  style={inp}
                  required
                />
              </div>
            </div>
            <div style={block}>
              <label style={lbl}>{t('daysCount')}</label>
              <input type="number" inputMode="numeric" min="1" value={lvDays} onChange={(e) => setLvDays(e.target.value)} style={inp} />
            </div>
            <div style={block}>
              <label style={lbl}>{t('notes')}</label>
              <input type="text" value={lvNotes} onChange={(e) => setLvNotes(e.target.value)} style={inp} />
            </div>
            <button type="submit" className="noorix-btn-primary" disabled={submitting} style={{ width: '100%', minHeight: 52, fontSize: 16, fontWeight: 700, touchAction: 'manipulation' }}>
              {submitting ? t('saving') : t('add')}
            </button>
          </form>
        )}

        {mode === 'deduction' && (
          <form onSubmit={onSubmitDeduction}>
            <div style={block}>
              <label style={lbl}>{t('selectEmployee')}</label>
              {empSelect(ddEmp, setDdEmp)}
            </div>
            <div style={block}>
              <label style={lbl}>{isAr ? 'نوع الخصم' : 'Deduction type'}</label>
              <select value={ddType} onChange={(e) => setDdType(e.target.value)} style={inp}>
                <option value="penalty">{isAr ? 'جزاء' : 'Penalty'}</option>
                <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
                <option value="advance">{isAr ? 'مرتبط بسلفة' : 'Advance-related'}</option>
              </select>
            </div>
            <div style={block}>
              <label style={lbl}>{t('advanceAmount')}</label>
              <input type="number" inputMode="decimal" step="0.01" min="0" value={ddAmount} onChange={(e) => setDdAmount(e.target.value)} style={inp} />
            </div>
            <div style={block}>
              <label style={lbl}>{t('transactionDate')}</label>
              <input type="date" value={ddDate} onChange={(e) => setDdDate(e.target.value)} style={inp} />
            </div>
            <div style={block}>
              <label style={lbl}>{t('notes')}</label>
              <input type="text" value={ddNotes} onChange={(e) => setDdNotes(e.target.value)} style={inp} placeholder={isAr ? 'السبب' : 'Reason'} />
            </div>
            <button type="submit" className="noorix-btn-primary" disabled={submitting} style={{ width: '100%', minHeight: 52, fontSize: 16, fontWeight: 700, touchAction: 'manipulation' }}>
              {submitting ? t('saving') : (isAr ? 'حفظ الخصم' : 'Save deduction')}
            </button>
          </form>
        )}

        {mode === 'increase' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              <button
                type="button"
                onClick={() => { setIncTab('movement'); setFormError(''); }}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 10,
                  border: incTab === 'movement' ? '2px solid #2563eb' : '1px solid var(--noorix-border)',
                  background: incTab === 'movement' ? 'rgba(37,99,235,0.08)' : 'var(--noorix-bg-surface)',
                  fontWeight: 700,
                  fontSize: 14,
                  touchAction: 'manipulation',
                }}
              >
                {isAr ? t('chatMovementSection') : 'Promotion / raise'}
              </button>
              <button
                type="button"
                onClick={() => { setIncTab('allowance'); setFormError(''); }}
                style={{
                  flex: 1,
                  minHeight: 48,
                  borderRadius: 10,
                  border: incTab === 'allowance' ? '2px solid #2563eb' : '1px solid var(--noorix-border)',
                  background: incTab === 'allowance' ? 'rgba(37,99,235,0.08)' : 'var(--noorix-bg-surface)',
                  fontWeight: 700,
                  fontSize: 14,
                  touchAction: 'manipulation',
                }}
              >
                {isAr ? t('chatAllowanceSection') : 'Allowance'}
              </button>
            </div>

            {incTab === 'movement' ? (
              <form onSubmit={onSubmitMovement}>
                <div style={block}>
                  <label style={lbl}>{t('selectEmployee')}</label>
                  {empSelect(mvEmp, setMvEmp)}
                </div>
                <div style={block}>
                  <label style={lbl}>{isAr ? t('movementTypeLabel') : 'Type'}</label>
                  <select value={mvType} onChange={(e) => setMvType(e.target.value)} style={inp}>
                    <option value="raise">{isAr ? 'زيادة' : 'Raise'}</option>
                    <option value="promotion">{isAr ? 'ترقية' : 'Promotion'}</option>
                    <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
                  </select>
                </div>
                <div style={block}>
                  <label style={lbl}>{isAr ? 'مبلغ (اختياري)' : 'Amount (optional)'}</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" value={mvAmount} onChange={(e) => setMvAmount(e.target.value)} style={inp} />
                </div>
                <div style={block}>
                  <label style={lbl}>{isAr ? t('previousValue') : 'Previous'}</label>
                  <input type="text" value={mvPrev} onChange={(e) => setMvPrev(e.target.value)} style={inp} />
                </div>
                <div style={block}>
                  <label style={lbl}>{isAr ? t('newValue') : 'New value'}</label>
                  <input type="text" value={mvNew} onChange={(e) => setMvNew(e.target.value)} style={inp} placeholder={isAr ? 'مثال: 8000 → 9000' : 'e.g. 8000 → 9000'} />
                </div>
                <div style={block}>
                  <label style={lbl}>{isAr ? t('effectiveDateLabel') : 'Effective date'}</label>
                  <input type="date" value={mvEff} onChange={(e) => setMvEff(e.target.value)} style={inp} required />
                </div>
                <div style={block}>
                  <label style={lbl}>{t('notes')}</label>
                  <input type="text" value={mvNotes} onChange={(e) => setMvNotes(e.target.value)} style={inp} />
                </div>
                <button type="submit" className="noorix-btn-primary" disabled={submitting} style={{ width: '100%', minHeight: 52, fontSize: 16, fontWeight: 700, touchAction: 'manipulation' }}>
                  {submitting ? t('saving') : (isAr ? 'حفظ' : 'Save')}
                </button>
              </form>
            ) : (
              <form onSubmit={onSubmitAllowance}>
                <div style={block}>
                  <label style={lbl}>{t('selectEmployee')}</label>
                  {empSelect(alEmp, setAlEmp)}
                </div>
                <div style={block}>
                  <label style={lbl}>{t('customAllowanceName')}</label>
                  <input type="text" value={alName} onChange={(e) => setAlName(e.target.value)} style={inp} placeholder={isAr ? 'مثال: بدل طبيعة عمل' : 'e.g. Field allowance'} />
                </div>
                <div style={block}>
                  <label style={lbl}>{t('customAllowanceAmount')}</label>
                  <input type="number" inputMode="decimal" step="0.01" min="0" value={alAmount} onChange={(e) => setAlAmount(e.target.value)} style={inp} />
                </div>
                <button type="submit" className="noorix-btn-primary" disabled={submitting} style={{ width: '100%', minHeight: 52, fontSize: 16, fontWeight: 700, touchAction: 'manipulation' }}>
                  {submitting ? t('saving') : (isAr ? 'حفظ البدلة' : 'Save allowance')}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

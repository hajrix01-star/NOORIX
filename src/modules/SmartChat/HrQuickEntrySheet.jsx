/**
 * HrQuickEntrySheet — إدخال سريع من المحادثة (سلفة، إجازة، خصم، زيادة/بدلة)
 * نافذة احترافية: بطاقة مركزية، حقول منسقة، دعم RTL، مناسب للجوال 100%.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { getEmployees, createLeave, createDeduction, createMovement, createCustomAllowance } from '../../services/api';
import { createAdvance } from '../../services/financialApi';
import { useVaults } from '../../hooks/useVaults';
import { getSaudiToday } from '../../utils/saudiDate';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { fmt } from '../../utils/format';

const TYPE_MAP = { annual: 'leaveAnnual', sick: 'leaveSick', unpaid: 'leaveUnpaid', other: 'leaveOther' };

const MODE_META = {
  advance:   { icon: '💳', labelAr: 'صرف سلفة',      labelEn: 'Pay advance' },
  leave:     { icon: '📅', labelAr: 'تسجيل إجازة',   labelEn: 'Add leave' },
  deduction: { icon: '📉', labelAr: 'تسجيل خصم',    labelEn: 'Record deduction' },
  increase:  { icon: '📈', labelAr: 'زيادة أو بدلة', labelEn: 'Raise or allowance' },
};

function invalidateHrQueries(qc, companyId) {
  qc.invalidateQueries({ queryKey: ['employees', companyId] });
  qc.invalidateQueries({ queryKey: ['employees-paged', companyId] });
  qc.invalidateQueries({ queryKey: ['leaves', companyId] });
  qc.invalidateQueries({ queryKey: ['deductions', companyId] });
  qc.invalidateQueries({ queryKey: ['custom-allowances', companyId] });
}

function Field({ id, label, children, error }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: 'var(--noorix-text)' }}>
        {label}
      </label>
      {children}
      {error && (
        <div style={{ marginTop: 4, fontSize: 12, color: 'var(--noorix-accent-red)' }}>{error}</div>
      )}
    </div>
  );
}

const inputBase = {
  width: '100%',
  minHeight: 48,
  padding: '12px 14px',
  fontSize: 16,
  borderRadius: 10,
  border: '1px solid var(--noorix-border)',
  background: 'var(--noorix-bg-surface)',
  color: 'var(--noorix-text)',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};

/** @param {{ mode: string, companyId: string, onClose: () => void, onRecorded?: (o: { textAr: string, textEn: string }) => void, variant?: 'sheet' | 'modal' }} props */
export function HrQuickEntrySheet({ mode, companyId, onClose, onRecorded, variant = 'sheet' }) {
  const { t, lang } = useTranslation();
  const qc = useQueryClient();
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const { vaultsList = [], isLoading: vaultsLoading } = useVaults({ companyId });
  const vaults = Array.isArray(vaultsList) ? vaultsList : [];

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['employees', companyId, false],
    queryFn: async () => {
      const res = await getEmployees(companyId, false);
      if (!res?.success) return [];
      const d = res.data;
      return Array.isArray(d) ? d : [];
    },
    enabled: !!companyId,
  });

  const activeEmployees = useMemo(
    () => (employees || []).filter((e) => e.status !== 'terminated' && e.status !== 'archived'),
    [employees],
  );

  const [advEmp, setAdvEmp] = useState('');
  const [advAmount, setAdvAmount] = useState('');
  const [advVault, setAdvVault] = useState('');
  const [advDate, setAdvDate] = useState(getSaudiToday());
  const [advNotes, setAdvNotes] = useState('');

  const [lvEmp, setLvEmp] = useState('');
  const [lvType, setLvType] = useState('annual');
  const [lvStart, setLvStart] = useState('');
  const [lvEnd, setLvEnd] = useState('');
  const [lvDays, setLvDays] = useState('');
  const [lvNotes, setLvNotes] = useState('');

  const [ddEmp, setDdEmp] = useState('');
  const [ddType, setDdType] = useState('penalty');
  const [ddAmount, setDdAmount] = useState('');
  const [ddDate, setDdDate] = useState(getSaudiToday());
  const [ddNotes, setDdNotes] = useState('');

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
  const [confirmStep, setConfirmStep] = useState(false);
  const [pendingData, setPendingData] = useState(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => { setFormError(''); }, [mode]);
  useEffect(() => { if (!confirmStep) setPendingData(null); }, [confirmStep]);

  useEffect(() => {
    if (vaults[0]?.id) setAdvVault((v) => v || vaults[0].id);
  }, [vaults]);

  useEffect(() => {
    if (!lvStart || !lvEnd) return;
    const s = new Date(lvStart);
    const e = new Date(lvEnd);
    if (e >= s) {
      const days = Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
      setLvDays(String(days));
    }
  }, [lvStart, lvEnd]);

  const closeOnSuccess = (variables, fallbackReport) => {
    setConfirmStep(false);
    setPendingData(null);
    const r = typeof variables === 'object' && variables?.report;
    onRecorded?.(r || fallbackReport);
    onCloseRef.current?.();
  };

  const advMut = useMutation({
    mutationFn: async (arg) => {
      const p = arg?.payload ?? arg;
      const res = await createAdvance(p);
      if (!res?.success) throw new Error(res?.error || 'Request failed');
      return res;
    },
    onSuccess: (_, variables) => {
      invalidateOnFinancialMutation(qc);
      invalidateHrQueries(qc, companyId);
      closeOnSuccess(variables, { textAr: 'تم تسجيل السلفة.', textEn: 'Advance recorded.' });
    },
    onError: (e) => setFormError(e?.message || String(e)),
  });

  const leaveMut = useMutation({
    mutationFn: async (arg) => {
      const body = arg?.payload ?? arg;
      const res = await createLeave(body);
      if (!res?.success) throw new Error(res?.error || 'Request failed');
      return res;
    },
    onSuccess: (_, variables) => {
      invalidateHrQueries(qc, companyId);
      closeOnSuccess(variables, { textAr: 'تم تسجيل الإجازة.', textEn: 'Leave recorded.' });
    },
    onError: (e) => setFormError(e?.message || String(e)),
  });

  const dedMut = useMutation({
    mutationFn: async (arg) => {
      const body = arg?.payload ?? arg;
      const res = await createDeduction(body);
      if (!res?.success) throw new Error(res?.error || 'Request failed');
      return res;
    },
    onSuccess: (_, variables) => {
      invalidateHrQueries(qc, companyId);
      closeOnSuccess(variables, { textAr: 'تم تسجيل الخصم.', textEn: 'Deduction recorded.' });
    },
    onError: (e) => setFormError(e?.message || String(e)),
  });

  const movMut = useMutation({
    mutationFn: async (arg) => {
      const body = arg?.payload ?? arg;
      const res = await createMovement(body);
      if (!res?.success) throw new Error(res?.error || 'Request failed');
      return res;
    },
    onSuccess: (_, variables) => {
      invalidateHrQueries(qc, companyId);
      closeOnSuccess(variables, { textAr: 'تم تسجيل الزيادة أو الترقية.', textEn: 'Promotion or raise recorded.' });
    },
    onError: (e) => setFormError(e?.message || String(e)),
  });

  const alMut = useMutation({
    mutationFn: async (arg) => {
      const body = arg?.payload ?? arg;
      const res = await createCustomAllowance(body);
      if (!res?.success) throw new Error(res?.error || 'Request failed');
      return res;
    },
    onSuccess: (_, variables) => {
      invalidateHrQueries(qc, companyId);
      closeOnSuccess(variables, { textAr: 'تم تسجيل البدلة الإضافية.', textEn: 'Allowance recorded.' });
    },
    onError: (e) => setFormError(e?.message || String(e)),
  });

  const submitting = advMut.isPending || leaveMut.isPending || dedMut.isPending || movMut.isPending || alMut.isPending;
  const meta = MODE_META[mode] || {};
  const title = isAr ? meta.labelAr : meta.labelEn;
  const dataLoading = employeesLoading || (mode === 'advance' && vaultsLoading);

  const empSelect = (value, onChange, id) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} required style={inputBase} disabled={dataLoading}>
      <option value="">{isAr ? '— اختر الموظف —' : '— Select employee —'}</option>
      {activeEmployees.map((emp) => (
        <option key={emp.id} value={emp.id}>{emp.name || emp.nameAr || '—'}</option>
      ))}
    </select>
  );

  const onSubmitAdvance = (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    const amt = parseFloat(String(advAmount).replace(',', '.'), 10);
    const emp = activeEmployees.find((x) => x.id === advEmp);
    if (!advEmp || !amt || amt <= 0) {
      setFormError(t('requiredFields'));
      return;
    }
    if (vaults.length === 0) {
      setFormError(isAr ? 'لا توجد خزائن. أضف خزنة من الخزائن أولاً.' : 'No vaults. Add a vault first.');
      return;
    }
    const vault = vaults.find((v) => v.id === (advVault || vaults[0]?.id));
    const payload = {
      employeeId: advEmp,
      companyId,
      vaultId: advVault || vaults[0]?.id,
      amount: amt,
      transactionDate: advDate,
      notes: advNotes.trim() || `سلفة — ${emp?.name || emp?.nameAr || ''}`,
      employeeName: emp?.name || emp?.nameAr,
    };
    const report = {
      textAr: `النوع: سلفة\nالاسم: ${emp?.name || emp?.nameAr || '—'}\nالمبلغ: ${fmt(amt, 2)} ﷼\nالخزنة: ${vault?.nameAr || vault?.nameEn || '—'}\nالتاريخ: ${advDate}`,
      textEn: `Type: Advance\nName: ${emp?.name || emp?.nameEn || emp?.nameAr || '—'}\nAmount: ${fmt(amt, 2)} SAR\nVault: ${vault?.nameEn || vault?.nameAr || '—'}\nDate: ${advDate}`,
    };
    setPendingData({ payload, report, mut: advMut });
    setConfirmStep(true);
  };

  const onSubmitLeave = (e) => {
    e.preventDefault();
    if (submitting) return;
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
    const emp = activeEmployees.find((x) => x.id === lvEmp);
    const days = lvDays ? parseInt(lvDays, 10) : Math.ceil((end.getTime() - s.getTime()) / 86400000) + 1;
    const payload = {
      companyId,
      employeeId: lvEmp,
      leaveType: lvType,
      startDate: `${lvStart}T00:00:00.000Z`,
      endDate: `${lvEnd}T00:00:00.000Z`,
      daysCount: days,
      status: 'pending',
      notes: lvNotes || undefined,
    };
    const report = {
      textAr: `النوع: إجازة\nالاسم: ${emp?.name || emp?.nameAr || '—'}\nالمدة: ${days} يوم\nمن: ${lvStart}\nإلى: ${lvEnd}`,
      textEn: `Type: Leave\nName: ${emp?.name || emp?.nameEn || '—'}\nDays: ${days}\nFrom: ${lvStart}\nTo: ${lvEnd}`,
    };
    setPendingData({ payload, report, mut: leaveMut });
    setConfirmStep(true);
  };

  const onSubmitDeduction = (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    const amt = parseFloat(String(ddAmount).replace(',', '.'), 10);
    if (!ddEmp || !amt || amt <= 0) {
      setFormError(t('requiredFields'));
      return;
    }
    const emp = activeEmployees.find((x) => x.id === ddEmp);
    const payload = {
      companyId,
      employeeId: ddEmp,
      deductionType: ddType,
      amount: amt,
      transactionDate: `${ddDate}T12:00:00.000Z`,
      notes: ddNotes || undefined,
    };
    const report = {
      textAr: `النوع: خصم\nالاسم: ${emp?.name || emp?.nameAr || '—'}\nالمبلغ: ${fmt(amt, 2)} ﷼\nالتاريخ: ${ddDate}`,
      textEn: `Type: Deduction\nName: ${emp?.name || emp?.nameEn || '—'}\nAmount: ${fmt(amt, 2)} SAR\nDate: ${ddDate}`,
    };
    setPendingData({ payload, report, mut: dedMut });
    setConfirmStep(true);
  };

  const onSubmitMovement = (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    if (!mvEmp || !mvEff) {
      setFormError(t('requiredFields'));
      return;
    }
    const emp = activeEmployees.find((x) => x.id === mvEmp);
    const amt = mvAmount.trim() ? parseFloat(String(mvAmount).replace(',', '.'), 10) : undefined;
    const payload = {
      companyId,
      employeeId: mvEmp,
      movementType: mvType,
      amount: Number.isFinite(amt) ? amt : undefined,
      previousValue: mvPrev || undefined,
      newValue: mvNew || undefined,
      effectiveDate: `${mvEff}T12:00:00.000Z`,
      notes: mvNotes || undefined,
    };
    const report = {
      textAr: `النوع: ${mvType === 'raise' ? 'زيادة' : mvType === 'promotion' ? 'ترقية' : 'حركة'}\nالاسم: ${emp?.name || emp?.nameAr || '—'}\n${Number.isFinite(amt) ? `المبلغ: ${fmt(amt, 2)} ﷼\n` : ''}التاريخ: ${mvEff}`,
      textEn: `Type: ${mvType === 'raise' ? 'Raise' : mvType === 'promotion' ? 'Promotion' : 'Movement'}\nName: ${emp?.name || emp?.nameEn || '—'}\n${Number.isFinite(amt) ? `Amount: ${fmt(amt, 2)} SAR\n` : ''}Date: ${mvEff}`,
    };
    setPendingData({ payload, report, mut: movMut });
    setConfirmStep(true);
  };

  const onSubmitAllowance = (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    const amt = parseFloat(String(alAmount).replace(',', '.'), 10);
    if (!alEmp || !alName.trim() || !amt || amt <= 0) {
      setFormError(t('requiredFields'));
      return;
    }
    const emp = activeEmployees.find((x) => x.id === alEmp);
    const payload = {
      companyId,
      employeeId: alEmp,
      nameAr: alName.trim(),
      amount: amt,
    };
    const report = {
      textAr: `النوع: بدلة\nالاسم: ${emp?.name || emp?.nameAr || '—'}\nالبند: ${alName.trim()}\nالمبلغ: ${fmt(amt, 2)} ﷼`,
      textEn: `Type: Allowance\nName: ${emp?.name || emp?.nameEn || '—'}\nItem: ${alName.trim()}\nAmount: ${fmt(amt, 2)} SAR`,
    };
    setPendingData({ payload, report, mut: alMut });
    setConfirmStep(true);
  };

  const handleConfirmSave = () => {
    if (!pendingData || submitting) return;
    const { payload, report, mut } = pendingData;
    mut.mutate({ payload, report });
  };

  const segmentBtn = (tab, label) => (
    <button
      type="button"
      key={tab}
      onClick={() => { setIncTab(tab); setFormError(''); }}
      className={incTab === tab ? 'noorix-btn-primary' : 'noorix-btn-nav'}
      style={{
        flex: 1,
        minHeight: 48,
        borderRadius: 10,
        fontSize: 14,
        fontWeight: 700,
        border: incTab === tab ? undefined : '1px solid var(--noorix-border)',
      }}
    >
      {label}
    </button>
  );

  const isModal = variant === 'modal';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="hr-sheet-title"
      dir={dir}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1002,
        background: 'rgba(0,0,0,0.48)',
        display: 'flex',
        alignItems: isModal ? 'center' : 'flex-end',
        justifyContent: 'center',
        padding: isModal ? 20 : 0,
        paddingBottom: isModal ? 20 : 'env(safe-area-inset-bottom)',
      }}
      onClick={onClose}
    >
      <div
        className="noorix-surface-card"
        style={{
          width: '100%',
          maxWidth: 480,
          maxHeight: isModal ? 'min(90vh, 640px)' : 'min(92vh, 680px)',
          margin: '0 auto',
          borderRadius: isModal ? 16 : '20px 20px 0 0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isModal ? '0 16px 48px rgba(0,0,0,0.2)' : '0 -8px 32px rgba(0,0,0,0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <header
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 20px',
            borderBottom: '1px solid var(--noorix-border)',
            background: 'var(--noorix-bg-surface)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 24 }}>{meta.icon}</span>
            <h2 id="hr-sheet-title" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--noorix-text)' }}>
              {title}
            </h2>
          </div>
          <button
            type="button"
            className="noorix-btn-nav"
            onClick={onClose}
            style={{ minHeight: 40, minWidth: 40, padding: '8px 12px', fontSize: 14 }}
            aria-label={isAr ? 'إغلاق' : 'Close'}
          >
            {isAr ? '✕' : '✕'}
          </button>
        </header>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            padding: 20,
          }}
        >
          {confirmStep && pendingData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--noorix-text-muted)' }}>{t('confirmSaveTitle')}</div>
              <div style={{ padding: 16, borderRadius: 12, background: 'var(--noorix-bg-muted)', fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {isAr ? pendingData.report?.textAr : pendingData.report?.textEn}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button type="button" className="noorix-btn-nav" onClick={() => setConfirmStep(false)} style={{ flex: 1, minHeight: 50 }}>
                  {isAr ? 'رجوع' : 'Back'}
                </button>
                <button
                  type="button"
                  className="noorix-btn-primary"
                  onClick={handleConfirmSave}
                  disabled={submitting}
                  style={{ flex: 1, minHeight: 50, fontSize: 15 }}
                >
                  {submitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : t('confirmSave')}
                </button>
              </div>
            </div>
          )}
          {!confirmStep && dataLoading && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--noorix-text-muted)' }}>
              {isAr ? 'جاري التحميل...' : 'Loading...'}
            </div>
          )}

          {!confirmStep && formError && (
            <div
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 10,
                background: 'rgba(220,38,38,0.08)',
                color: 'var(--noorix-accent-red)',
                fontSize: 14,
              }}
            >
              {formError}
            </div>
          )}

          {!confirmStep && !dataLoading && mode === 'advance' && (
            <form onSubmit={onSubmitAdvance}>
              <Field id="adv-emp" label={t('selectEmployee')}>
                {empSelect(advEmp, setAdvEmp, 'adv-emp')}
              </Field>
              <Field id="adv-amt" label={t('advanceAmount')}>
                <input
                  id="adv-amt"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={advAmount}
                  onChange={(e) => setAdvAmount(e.target.value)}
                  style={inputBase}
                  placeholder="0"
                />
              </Field>
              <Field id="adv-vault" label={t('selectVault')}>
                <select id="adv-vault" value={advVault} onChange={(e) => setAdvVault(e.target.value)} style={inputBase} required>
                  {vaults.length === 0 && <option value="">{isAr ? '— لا توجد خزائن —' : '— No vaults —'}</option>}
                  {vaults.map((v) => (
                    <option key={v.id} value={v.id}>{v.nameAr || v.nameEn || v.id}</option>
                  ))}
                </select>
              </Field>
              <Field id="adv-date" label={t('transactionDate')}>
                <input id="adv-date" type="date" value={advDate} onChange={(e) => setAdvDate(e.target.value)} style={{ ...inputBase, direction: 'ltr' }} lang="en" />
              </Field>
              <Field id="adv-notes" label={t('notes')}>
                <input id="adv-notes" type="text" value={advNotes} onChange={(e) => setAdvNotes(e.target.value)} style={inputBase} placeholder={isAr ? 'سبب أو تفاصيل' : 'Reason or details'} />
              </Field>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="noorix-btn-nav" onClick={onClose} style={{ flex: 1, minHeight: 50 }}>
                  {t('cancel')}
                </button>
                <button type="submit" className="noorix-btn-primary" disabled={submitting || vaults.length === 0} style={{ flex: 1, minHeight: 50, fontSize: 15 }}>
                  {submitting ? t('saving') : t('payAdvance')}
                </button>
              </div>
            </form>
          )}

          {!confirmStep && !dataLoading && mode === 'leave' && (
            <form onSubmit={onSubmitLeave}>
              <Field id="lv-emp" label={t('selectEmployee')}>
                {empSelect(lvEmp, setLvEmp, 'lv-emp')}
              </Field>
              <Field id="lv-type" label={t('leaveType')}>
                <select id="lv-type" value={lvType} onChange={(e) => setLvType(e.target.value)} style={inputBase}>
                  {Object.keys(TYPE_MAP).map((k) => (
                    <option key={k} value={k}>{t(TYPE_MAP[k])}</option>
                  ))}
                </select>
              </Field>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <Field id="lv-start" label={t('startDate')}>
                  <input id="lv-start" type="date" value={lvStart} onChange={(e) => setLvStart(e.target.value)} style={{ ...inputBase, direction: 'ltr' }} lang="en" required />
                </Field>
                <Field id="lv-end" label={t('endDate')}>
                  <input id="lv-end" type="date" value={lvEnd} onChange={(e) => setLvEnd(e.target.value)} style={{ ...inputBase, direction: 'ltr' }} lang="en" required />
                </Field>
              </div>
              <Field id="lv-days" label={t('daysCount')}>
                <input id="lv-days" type="number" inputMode="numeric" min="1" value={lvDays} onChange={(e) => setLvDays(e.target.value)} style={inputBase} placeholder="—" />
              </Field>
              <Field id="lv-notes" label={t('notes')}>
                <input id="lv-notes" type="text" value={lvNotes} onChange={(e) => setLvNotes(e.target.value)} style={inputBase} />
              </Field>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="noorix-btn-nav" onClick={onClose} style={{ flex: 1, minHeight: 50 }}>{t('cancel')}</button>
                <button type="submit" className="noorix-btn-primary" disabled={submitting} style={{ flex: 1, minHeight: 50, fontSize: 15 }}>{submitting ? t('saving') : t('add')}</button>
              </div>
            </form>
          )}

          {!confirmStep && !dataLoading && mode === 'deduction' && (
            <form onSubmit={onSubmitDeduction}>
              <Field id="dd-emp" label={t('selectEmployee')}>
                {empSelect(ddEmp, setDdEmp, 'dd-emp')}
              </Field>
              <Field id="dd-type" label={isAr ? 'نوع الخصم' : 'Deduction type'}>
                <select id="dd-type" value={ddType} onChange={(e) => setDdType(e.target.value)} style={inputBase}>
                  <option value="penalty">{isAr ? 'جزاء' : 'Penalty'}</option>
                  <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
                  <option value="advance">{isAr ? 'مرتبط بسلفة' : 'Advance-related'}</option>
                </select>
              </Field>
              <Field id="dd-amt" label={t('advanceAmount')}>
                <input id="dd-amt" type="number" inputMode="decimal" step="0.01" min="0" value={ddAmount} onChange={(e) => setDdAmount(e.target.value)} style={inputBase} />
              </Field>
              <Field id="dd-date" label={t('transactionDate')}>
                <input id="dd-date" type="date" value={ddDate} onChange={(e) => setDdDate(e.target.value)} style={{ ...inputBase, direction: 'ltr' }} lang="en" />
              </Field>
              <Field id="dd-notes" label={t('notes')}>
                <input id="dd-notes" type="text" value={ddNotes} onChange={(e) => setDdNotes(e.target.value)} style={inputBase} placeholder={isAr ? 'السبب' : 'Reason'} />
              </Field>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="noorix-btn-nav" onClick={onClose} style={{ flex: 1, minHeight: 50 }}>{t('cancel')}</button>
                <button type="submit" className="noorix-btn-primary" disabled={submitting} style={{ flex: 1, minHeight: 50, fontSize: 15 }}>{submitting ? t('saving') : (isAr ? 'حفظ الخصم' : 'Save deduction')}</button>
              </div>
            </form>
          )}

          {!confirmStep && !dataLoading && mode === 'increase' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {segmentBtn('movement', isAr ? t('chatMovementSection') : 'Promotion / raise')}
                {segmentBtn('allowance', isAr ? t('chatAllowanceSection') : 'Allowance')}
              </div>

              {incTab === 'movement' ? (
                <form onSubmit={onSubmitMovement}>
                  <Field id="mv-emp" label={t('selectEmployee')}>{empSelect(mvEmp, setMvEmp, 'mv-emp')}</Field>
                  <Field id="mv-type" label={isAr ? t('movementTypeLabel') : 'Type'}>
                    <select id="mv-type" value={mvType} onChange={(e) => setMvType(e.target.value)} style={inputBase}>
                      <option value="raise">{isAr ? 'زيادة' : 'Raise'}</option>
                      <option value="promotion">{isAr ? 'ترقية' : 'Promotion'}</option>
                      <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
                    </select>
                  </Field>
                  <Field id="mv-amt" label={isAr ? 'مبلغ (اختياري)' : 'Amount (optional)'}>
                    <input id="mv-amt" type="number" inputMode="decimal" step="0.01" min="0" value={mvAmount} onChange={(e) => setMvAmount(e.target.value)} style={inputBase} />
                  </Field>
                  <Field id="mv-prev" label={isAr ? t('previousValue') : 'Previous'}>
                    <input id="mv-prev" type="text" value={mvPrev} onChange={(e) => setMvPrev(e.target.value)} style={inputBase} />
                  </Field>
                  <Field id="mv-new" label={isAr ? t('newValue') : 'New value'}>
                    <input id="mv-new" type="text" value={mvNew} onChange={(e) => setMvNew(e.target.value)} style={inputBase} placeholder={isAr ? 'مثال: 8000 → 9000' : 'e.g. 8000 → 9000'} />
                  </Field>
                  <Field id="mv-eff" label={isAr ? t('effectiveDateLabel') : 'Effective date'}>
                    <input id="mv-eff" type="date" value={mvEff} onChange={(e) => setMvEff(e.target.value)} style={{ ...inputBase, direction: 'ltr' }} lang="en" required />
                  </Field>
                  <Field id="mv-notes" label={t('notes')}>
                    <input id="mv-notes" type="text" value={mvNotes} onChange={(e) => setMvNotes(e.target.value)} style={inputBase} />
                  </Field>
                  <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                    <button type="button" className="noorix-btn-nav" onClick={onClose} style={{ flex: 1, minHeight: 50 }}>{t('cancel')}</button>
                    <button type="submit" className="noorix-btn-primary" disabled={submitting} style={{ flex: 1, minHeight: 50 }}>{submitting ? t('saving') : (isAr ? 'حفظ' : 'Save')}</button>
                  </div>
                </form>
              ) : (
                <form onSubmit={onSubmitAllowance}>
                  <Field id="al-emp" label={t('selectEmployee')}>{empSelect(alEmp, setAlEmp, 'al-emp')}</Field>
                  <Field id="al-name" label={t('customAllowanceName')}>
                    <input id="al-name" type="text" value={alName} onChange={(e) => setAlName(e.target.value)} style={inputBase} placeholder={isAr ? 'مثال: بدل طبيعة عمل' : 'e.g. Field allowance'} />
                  </Field>
                  <Field id="al-amt" label={t('customAllowanceAmount')}>
                    <input id="al-amt" type="number" inputMode="decimal" step="0.01" min="0" value={alAmount} onChange={(e) => setAlAmount(e.target.value)} style={inputBase} />
                  </Field>
                  <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                    <button type="button" className="noorix-btn-nav" onClick={onClose} style={{ flex: 1, minHeight: 50 }}>{t('cancel')}</button>
                    <button type="submit" className="noorix-btn-primary" disabled={submitting} style={{ flex: 1, minHeight: 50 }}>{submitting ? t('saving') : (isAr ? 'حفظ البدلة' : 'Save allowance')}</button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

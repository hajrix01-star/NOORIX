/**
 * HrQuickEntrySheet — إدخال سريع من المحادثة (سلفة، إجازة، خصم، زيادة/بدلة)
 * نافذة احترافية: بطاقة مركزية، حقول منسقة، دعم RTL، مناسب للجوال 100%.
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from '../../i18n/useTranslation';
import { Button, AdaptiveSheet, Input } from '../../ui';
import { getEmployees, createLeave, createDeduction, createMovement, createCustomAllowance } from '../../services/api';
import { createAdvance } from '../../services/financialApi';
import { useVaults } from '../../hooks/useVaults';
import { getSaudiToday } from '../../utils/saudiDate';
import { invalidateOnFinancialMutation } from '../../utils/queryInvalidation';
import { roundMoney2 } from '../../utils/moneyInput';
import { fmt } from '../../utils/format';
import { employeeDisplayName } from '../../utils/employeeDisplayName';

const TYPE_MAP = { annual: 'leaveAnnual', sick: 'leaveSick', unpaid: 'leaveUnpaid', other: 'leaveOther' };

const MODE_META = {
  advance:   { icon: '', labelAr: 'صرف سلفة',      labelEn: 'Pay advance' },
  leave:     { icon: '', labelAr: 'تسجيل إجازة',   labelEn: 'Add leave' },
  deduction: { icon: '', labelAr: 'تسجيل خصم',    labelEn: 'Record deduction' },
  increase:  { icon: '', labelAr: 'زيادة أو بدلة', labelEn: 'Raise or allowance' },
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
    <div className="nx-mb-16">
      <label htmlFor={id} className="nx-text-base nx-font-600 nx-mb-6" style={{ display: 'block' }}>
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

/** @param {{ mode: string, companyId: string, onClose: () => void, onRecorded?: (o: { textAr: string, textEn: string }) => void }} props */
export function HrQuickEntrySheet({ mode, companyId, onClose, onRecorded }) {
  const { t, lang } = useTranslation();
  const qc = useQueryClient();
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const { paymentVaults = [], isLoading: vaultsLoading } = useVaults({ companyId });
  const vaults = paymentVaults;

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

  // vault stays empty by default — user must explicitly select

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
    <Input id={id} type="select" value={value} onChange={(e) => onChange(e.target.value)} required disabled={dataLoading}>
      <option value="">{isAr ? '— اختر الموظف —' : '— Select employee —'}</option>
      {activeEmployees.map((emp) => (
        <option key={emp.id} value={emp.id}>{employeeDisplayName(emp, lang)}</option>
      ))}
    </Input>
  );

  const onSubmitAdvance = (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    const amt = parseFloat(String(advAmount).replace(',', '.'));
    const emp = activeEmployees.find((x) => x.id === advEmp);
    if (!advEmp || !amt || amt <= 0) {
      setFormError(t('requiredFields'));
      return;
    }
    if (vaults.length === 0) {
      setFormError(isAr ? 'لا توجد خزائن. أضف خزنة من الخزائن أولاً.' : 'No vaults. Add a vault first.');
      return;
    }
    const vault = vaults.find((v) => v.id === advVault);
    const payload = {
      employeeId: advEmp,
      companyId,
      vaultId: advVault || undefined,
      amount: amt,
      transactionDate: advDate,
      notes: advNotes.trim() || `سلفة — ${employeeDisplayName(emp, 'ar', '')}`,
      employeeName: employeeDisplayName(emp, 'ar'),
    };
    const report = {
      textAr: `النوع: سلفة\nالاسم: ${employeeDisplayName(emp, 'ar')}\nالمبلغ: ${fmt(amt, 2)} ﷼\nالخزنة: ${vault?.nameAr || vault?.nameEn || '—'}\nالتاريخ: ${advDate}`,
      textEn: `Type: Advance\nName: ${employeeDisplayName(emp, 'en')}\nAmount: ${fmt(amt, 2)} SAR\nVault: ${vault?.nameEn || vault?.nameAr || '—'}\nDate: ${advDate}`,
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
      textAr: `النوع: إجازة\nالاسم: ${employeeDisplayName(emp, 'ar')}\nالمدة: ${days} يوم\nمن: ${lvStart}\nإلى: ${lvEnd}`,
      textEn: `Type: Leave\nName: ${employeeDisplayName(emp, 'en')}\nDays: ${days}\nFrom: ${lvStart}\nTo: ${lvEnd}`,
    };
    setPendingData({ payload, report, mut: leaveMut });
    setConfirmStep(true);
  };

  const onSubmitDeduction = (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    const amt = parseFloat(String(ddAmount).replace(',', '.'));
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
      textAr: `النوع: خصم\nالاسم: ${employeeDisplayName(emp, 'ar')}\nالمبلغ: ${fmt(amt, 2)} ﷼\nالتاريخ: ${ddDate}`,
      textEn: `Type: Deduction\nName: ${employeeDisplayName(emp, 'en')}\nAmount: ${fmt(amt, 2)} SAR\nDate: ${ddDate}`,
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
    const amt = mvAmount.trim() ? parseFloat(String(mvAmount).replace(',', '.')) : undefined;
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
      textAr: `النوع: ${mvType === 'raise' ? 'زيادة' : mvType === 'promotion' ? 'ترقية' : 'حركة'}\nالاسم: ${employeeDisplayName(emp, 'ar')}\n${Number.isFinite(amt) ? `المبلغ: ${fmt(amt, 2)} ﷼\n` : ''}التاريخ: ${mvEff}`,
      textEn: `Type: ${mvType === 'raise' ? 'Raise' : mvType === 'promotion' ? 'Promotion' : 'Movement'}\nName: ${employeeDisplayName(emp, 'en')}\n${Number.isFinite(amt) ? `Amount: ${fmt(amt, 2)} SAR\n` : ''}Date: ${mvEff}`,
    };
    setPendingData({ payload, report, mut: movMut });
    setConfirmStep(true);
  };

  const onSubmitAllowance = (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    const amt = parseFloat(String(alAmount).replace(',', '.'));
    const amtRounded = roundMoney2(amt);
    if (!alEmp || !alName.trim() || !amtRounded || amtRounded <= 0) {
      setFormError(t('requiredFields'));
      return;
    }
    const emp = activeEmployees.find((x) => x.id === alEmp);
    const payload = {
      companyId,
      employeeId: alEmp,
      nameAr: alName.trim(),
      amount: amtRounded,
    };
    const report = {
      textAr: `النوع: بدلة\nالاسم: ${employeeDisplayName(emp, 'ar')}\nالبند: ${alName.trim()}\nالمبلغ: ${fmt(amtRounded, 2)} ﷼`,
      textEn: `Type: Allowance\nName: ${employeeDisplayName(emp, 'en')}\nItem: ${alName.trim()}\nAmount: ${fmt(amtRounded, 2)} SAR`,
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
    <Button
      key={tab}
      onClick={() => { setIncTab(tab); setFormError(''); }}
      variant={incTab === tab ? 'primary' : 'default'}
      style={{ flex: 1, minHeight: 48 }}
    >
      {label}
    </Button>
  );

  return (
    <AdaptiveSheet open={true} onClose={onClose} title={title} size="md" side="start" className="hr-quick-entry-drawer">
        <div
          dir={dir}
          style={{
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {confirmStep && pendingData && (
            <div className="nx-flex nx-flex-col nx-gap-20">
              <div className="nx-text-md nx-font-600 nx-text-muted">{t('confirmSaveTitle')}</div>
              <div className="nx-p-16 nx-rounded-lg nx-bg-muted nx-text-lg" style={{ lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {isAr ? pendingData.report?.textAr : pendingData.report?.textEn}
              </div>
              <div className="nx-flex nx-gap-12">
                <Button onClick={() => setConfirmStep(false)} style={{ flex: 1, minHeight: 50 }}>
                  {isAr ? 'رجوع' : 'Back'}
                </Button>
                <Button
                  variant="primary"
                  onClick={handleConfirmSave}
                  disabled={submitting}
                  style={{ flex: 1, minHeight: 50, fontSize: 15 }}
                >
                  {submitting ? (isAr ? 'جاري الحفظ...' : 'Saving...') : t('confirmSave')}
                </Button>
              </div>
            </div>
          )}
          {!confirmStep && dataLoading && (
            <div className="nx-text-center nx-p-24 nx-text-muted">
              {isAr ? 'جاري التحميل...' : 'Loading...'}
            </div>
          )}

          {!confirmStep && formError && (
            <div
              className="nx-mb-16 nx-p-12 nx-rounded nx-text-md"
              style={{
                background: 'rgba(220,38,38,0.08)',
                color: 'var(--noorix-accent-red)',
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
                <Input
                  id="adv-amt"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={advAmount}
                  onChange={(e) => setAdvAmount(e.target.value)}
                  placeholder="0"
                />
              </Field>
              <Field id="adv-vault" label={t('selectVault')}>
                <Input id="adv-vault" type="select" value={advVault} onChange={(e) => setAdvVault(e.target.value)} required>
                  <option value="">{isAr ? '— اختر الخزينة —' : '— Select Vault —'}</option>
                  {vaults.map((v) => (
                    <option key={v.id} value={v.id}>{v.nameAr || v.nameEn || v.id}</option>
                  ))}
                </Input>
              </Field>
              <Field id="adv-date" label={t('transactionDate')}>
                <Input id="adv-date" type="date" value={advDate} onChange={(e) => setAdvDate(e.target.value)} style={{ direction: 'ltr' }} lang="en" />
              </Field>
              <Field id="adv-notes" label={t('notes')}>
                <Input id="adv-notes" type="text" value={advNotes} onChange={(e) => setAdvNotes(e.target.value)} placeholder={isAr ? 'سبب أو تفاصيل' : 'Reason or details'} />
              </Field>
              <div className="nx-flex nx-gap-12 nx-mt-20">
                <Button onClick={onClose} style={{ flex: 1, minHeight: 50 }}>
                  {t('cancel')}
                </Button>
                <Button type="submit" variant="primary" disabled={submitting || vaults.length === 0} style={{ flex: 1, minHeight: 50, fontSize: 15 }}>
                  {submitting ? t('saving') : t('payAdvance')}
                </Button>
              </div>
            </form>
          )}

          {!confirmStep && !dataLoading && mode === 'leave' && (
            <form onSubmit={onSubmitLeave}>
              <Field id="lv-emp" label={t('selectEmployee')}>
                {empSelect(lvEmp, setLvEmp, 'lv-emp')}
              </Field>
              <Field id="lv-type" label={t('leaveType')}>
                <Input id="lv-type" type="select" value={lvType} onChange={(e) => setLvType(e.target.value)}>
                  {Object.keys(TYPE_MAP).map((k) => (
                    <option key={k} value={k}>{t(TYPE_MAP[k])}</option>
                  ))}
                </Input>
              </Field>
              <div className="nx-grid-2 nx-gap-12 nx-mb-16">
                <Field id="lv-start" label={t('startDate')}>
                  <Input id="lv-start" type="date" value={lvStart} onChange={(e) => setLvStart(e.target.value)} style={{ direction: 'ltr' }} lang="en" required />
                </Field>
                <Field id="lv-end" label={t('endDate')}>
                  <Input id="lv-end" type="date" value={lvEnd} onChange={(e) => setLvEnd(e.target.value)} style={{ direction: 'ltr' }} lang="en" required />
                </Field>
              </div>
              <Field id="lv-days" label={t('daysCount')}>
                <Input id="lv-days" type="number" inputMode="numeric" min="1" value={lvDays} onChange={(e) => setLvDays(e.target.value)} placeholder="—" />
              </Field>
              <Field id="lv-notes" label={t('notes')}>
                <Input id="lv-notes" type="text" value={lvNotes} onChange={(e) => setLvNotes(e.target.value)} />
              </Field>
              <div className="nx-flex nx-gap-12 nx-mt-20">
                <Button onClick={onClose} style={{ flex: 1, minHeight: 50 }}>{t('cancel')}</Button>
                <Button type="submit" variant="primary" disabled={submitting} style={{ flex: 1, minHeight: 50, fontSize: 15 }}>{submitting ? t('saving') : t('add')}</Button>
              </div>
            </form>
          )}

          {!confirmStep && !dataLoading && mode === 'deduction' && (
            <form onSubmit={onSubmitDeduction}>
              <Field id="dd-emp" label={t('selectEmployee')}>
                {empSelect(ddEmp, setDdEmp, 'dd-emp')}
              </Field>
              <Field id="dd-type" label={isAr ? 'نوع الخصم' : 'Deduction type'}>
                <Input id="dd-type" type="select" value={ddType} onChange={(e) => setDdType(e.target.value)}>
                  <option value="penalty">{isAr ? 'جزاء' : 'Penalty'}</option>
                  <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
                  <option value="advance">{isAr ? 'مرتبط بسلفة' : 'Advance-related'}</option>
                </Input>
              </Field>
              <Field id="dd-amt" label={isAr ? 'مبلغ الخصم' : 'Deduction amount'}>
                <Input id="dd-amt" type="number" inputMode="decimal" step="0.01" min="0" value={ddAmount} onChange={(e) => setDdAmount(e.target.value)} />
              </Field>
              <Field id="dd-date" label={t('transactionDate')}>
                <Input id="dd-date" type="date" value={ddDate} onChange={(e) => setDdDate(e.target.value)} style={{ direction: 'ltr' }} lang="en" />
              </Field>
              <Field id="dd-notes" label={t('notes')}>
                <Input id="dd-notes" type="text" value={ddNotes} onChange={(e) => setDdNotes(e.target.value)} placeholder={isAr ? 'السبب' : 'Reason'} />
              </Field>
              <div className="nx-flex nx-gap-12 nx-mt-20">
                <Button onClick={onClose} style={{ flex: 1, minHeight: 50 }}>{t('cancel')}</Button>
                <Button type="submit" variant="primary" disabled={submitting} style={{ flex: 1, minHeight: 50, fontSize: 15 }}>{submitting ? t('saving') : (isAr ? 'حفظ الخصم' : 'Save deduction')}</Button>
              </div>
            </form>
          )}

          {!confirmStep && !dataLoading && mode === 'increase' && (
            <div>
              <div className="nx-flex nx-gap-8 nx-mb-16">
                {segmentBtn('movement', isAr ? t('chatMovementSection') : 'Promotion / raise')}
                {segmentBtn('allowance', isAr ? t('chatAllowanceSection') : 'Allowance')}
              </div>

              {incTab === 'movement' ? (
                <form onSubmit={onSubmitMovement}>
                  <Field id="mv-emp" label={t('selectEmployee')}>{empSelect(mvEmp, setMvEmp, 'mv-emp')}</Field>
                  <Field id="mv-type" label={isAr ? t('movementTypeLabel') : 'Type'}>
                    <Input id="mv-type" type="select" value={mvType} onChange={(e) => setMvType(e.target.value)}>
                      <option value="raise">{isAr ? 'زيادة' : 'Raise'}</option>
                      <option value="promotion">{isAr ? 'ترقية' : 'Promotion'}</option>
                      <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
                    </Input>
                  </Field>
                  <Field id="mv-amt" label={isAr ? 'مبلغ (اختياري)' : 'Amount (optional)'}>
                    <Input id="mv-amt" type="number" inputMode="decimal" step="0.01" min="0" value={mvAmount} onChange={(e) => setMvAmount(e.target.value)} />
                  </Field>
                  <Field id="mv-prev" label={isAr ? t('previousValue') : 'Previous'}>
                    <Input id="mv-prev" type="text" value={mvPrev} onChange={(e) => setMvPrev(e.target.value)} />
                  </Field>
                  <Field id="mv-new" label={isAr ? t('newValue') : 'New value'}>
                    <Input id="mv-new" type="text" value={mvNew} onChange={(e) => setMvNew(e.target.value)} placeholder={isAr ? 'مثال: 8000 → 9000' : 'e.g. 8000 → 9000'} />
                  </Field>
                  <Field id="mv-eff" label={isAr ? t('effectiveDateLabel') : 'Effective date'}>
                    <Input id="mv-eff" type="date" value={mvEff} onChange={(e) => setMvEff(e.target.value)} style={{ direction: 'ltr' }} lang="en" required />
                  </Field>
                  <Field id="mv-notes" label={t('notes')}>
                    <Input id="mv-notes" type="text" value={mvNotes} onChange={(e) => setMvNotes(e.target.value)} />
                  </Field>
                  <div className="nx-flex nx-gap-12 nx-mt-20">
                    <Button onClick={onClose} style={{ flex: 1, minHeight: 50 }}>{t('cancel')}</Button>
                    <Button type="submit" variant="primary" disabled={submitting} style={{ flex: 1, minHeight: 50 }}>{submitting ? t('saving') : (isAr ? 'حفظ' : 'Save')}</Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={onSubmitAllowance}>
                  <Field id="al-emp" label={t('selectEmployee')}>{empSelect(alEmp, setAlEmp, 'al-emp')}</Field>
                  <Field id="al-name" label={t('customAllowanceName')}>
                    <Input id="al-name" type="text" value={alName} onChange={(e) => setAlName(e.target.value)} placeholder={isAr ? 'مثال: بدل طبيعة عمل' : 'e.g. Field allowance'} />
                  </Field>
                  <Field id="al-amt" label={t('customAllowanceAmount')}>
                    <Input id="al-amt" type="number" inputMode="decimal" step="0.01" min="0" value={alAmount} onChange={(e) => setAlAmount(e.target.value)} />
                  </Field>
                  <div className="nx-flex nx-gap-12 nx-mt-20">
                    <Button onClick={onClose} style={{ flex: 1, minHeight: 50 }}>{t('cancel')}</Button>
                    <Button type="submit" variant="primary" disabled={submitting} style={{ flex: 1, minHeight: 50 }}>{submitting ? t('saving') : (isAr ? 'حفظ البدلة' : 'Save allowance')}</Button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
    </AdaptiveSheet>
  );
}

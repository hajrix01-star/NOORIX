/**
 * HrQuickEntrySheet — إدخال سريع من المحادثة (حاوية)
 */
import React, { useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from '../../../../i18n/useTranslation';
import { Button, AdaptiveSheet, Input } from '../../../../ui';
import { employeeDisplayName } from '../../../../utils/employeeDisplayName';
import { getEmployeeCompensationSnapshots, throwIfApiFailed } from '../../../../services/api';
import { hrKeys } from '../../../../services/queryKeys';
import { useHrQuickEntryState } from './hooks/useHrQuickEntryState';
import { useHrQuickEntryRows } from './hooks/useHrQuickEntryRows';
import { useHrQuickEntryMutations } from './hooks/useHrQuickEntryMutations';
import { useHrQuickEntryActions } from './hooks/useHrQuickEntryActions';
import { HrQuickEntryTable } from './components/HrQuickEntryTable';
import { HrQuickEntrySummary } from './components/HrQuickEntrySummary';
import { HrQuickEntryAdvanceForm } from './components/HrQuickEntryAdvanceForm';
import { HrQuickEntryLeaveForm } from './components/HrQuickEntryLeaveForm';
import { HrQuickEntryDeductionForm } from './components/HrQuickEntryDeductionForm';
import { HrQuickEntryIncreaseForm } from './components/HrQuickEntryIncreaseForm';
import { MODE_META } from './constants';
import type { HrQuickEntryMode, HrQuickEntrySheetProps } from './types';

export function HrQuickEntrySheet({ mode, companyId, onClose, onRecorded, variant: _variant }: HrQuickEntrySheetProps) {
  const { t, lang } = useTranslation();
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const st = useHrQuickEntryState(mode as HrQuickEntryMode, companyId);

  const { activeEmployees } = useHrQuickEntryRows(st.employees as never[]);
  const activeEmployeeIds = React.useMemo(
    () => activeEmployees.map((emp) => String(emp.id || '')).filter(Boolean),
    [activeEmployees],
  );
  const {
    data: compensationSnapshots,
    isLoading: compensationSnapshotsLoading,
    error: compensationSnapshotsError,
  } = useQuery({
    queryKey: hrKeys.compensationSnapshots(companyId, activeEmployeeIds),
    queryFn: async () => {
      const res = await getEmployeeCompensationSnapshots(companyId, activeEmployeeIds);
      throwIfApiFailed(res, t('loadingError'));
      return res.data;
    },
    enabled: mode === 'increase' && !!companyId && activeEmployeeIds.length > 0,
  });
  const compensationSnapshotByEmployeeId = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const snapshot of compensationSnapshots?.items ?? []) {
      if (snapshot?.employeeId) map.set(String(snapshot.employeeId), snapshot);
    }
    return map;
  }, [compensationSnapshots]);

  const { advMut, leaveMut, dedMut, movMut, alMut, submitting } = useHrQuickEntryMutations({
    companyId,
    onCloseRef,
    onRecorded,
    setFormError: st.setFormError,
    setConfirmStep: st.setConfirmStep,
    setPendingData: st.setPendingData,
  });

  const stateSlice = {
    advEmp: st.advEmp,
    advAmount: st.advAmount,
    advVault: st.advVault,
    advDate: st.advDate,
    advNotes: st.advNotes,
    lvEmp: st.lvEmp,
    lvType: st.lvType,
    lvStart: st.lvStart,
    lvEnd: st.lvEnd,
    lvDays: st.lvDays,
    lvNotes: st.lvNotes,
    ddEmp: st.ddEmp,
    ddType: st.ddType,
    ddAmount: st.ddAmount,
    ddDate: st.ddDate,
    ddNotes: st.ddNotes,
    mvEmp: st.mvEmp,
    mvType: st.mvType,
    mvAmount: st.mvAmount,
    mvPrev: st.mvPrev,
    mvNew: st.mvNew,
    mvEff: st.mvEff,
    mvNotes: st.mvNotes,
    alEmp: st.alEmp,
    alName: st.alName,
    alAmount: st.alAmount,
  };

  const actions = useHrQuickEntryActions({
    companyId,
    isAr,
    t,
    submitting,
    activeEmployees,
    employees: st.employees as Array<Record<string, unknown> & { id?: string }>,
    compensationSnapshotByEmployeeId,
    vaults: st.vaults as never[],
    st: stateSlice,
    advMut,
    leaveMut,
    dedMut,
    movMut,
    alMut,
    pendingData: st.pendingData,
    setFormError: st.setFormError,
    setConfirmStep: st.setConfirmStep,
    setPendingData: st.setPendingData,
  });

  const meta = (MODE_META as Record<string, { labelAr: string; labelEn: string }>)[String(mode)] || MODE_META.advance;
  const title = isAr ? meta.labelAr : meta.labelEn;
  const dataLoading = st.dataLoading || (mode === 'increase' && compensationSnapshotsLoading);

  const empSelect = (value: string, onChange: (v: string) => void, id: string) => (
    <Input id={id} type="select" value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)} required disabled={dataLoading}>
      <option value="">{isAr ? '— اختر الموظف —' : '— Select employee —'}</option>
      {activeEmployees.map((emp) => (
        <option key={emp.id} value={emp.id}>
          {employeeDisplayName(emp, lang)}
        </option>
      ))}
    </Input>
  );

  const previewText =
    st.pendingData && (isAr ? st.pendingData.report?.textAr : st.pendingData.report?.textEn);

  return (
    <AdaptiveSheet open={true} onClose={onClose} title={title} size="md" side="start" className="hr-quick-entry-drawer">
      <HrQuickEntryTable dir={dir}>
        {st.confirmStep && st.pendingData && (
          <HrQuickEntrySummary
            confirmTitle={t('confirmSaveTitle')}
            previewText={previewText || ''}
            submitting={submitting}
            backLabel={isAr ? 'رجوع' : 'Back'}
            savingLabel={isAr ? 'جاري الحفظ...' : 'Saving...'}
            confirmLabel={t('confirmSave')}
            onBack={() => st.setConfirmStep(false)}
            onConfirm={actions.handleConfirmSave}
          />
        )}
        {!st.confirmStep && dataLoading && (
          <div className="text-center p-6 text-noorix-muted">{isAr ? 'جاري التحميل...' : 'Loading...'}</div>
        )}
        {!st.confirmStep && st.formError && (
          <div
            className="mb-4 p-3 rounded-lg text-[14px]"
            style={{
              background: 'var(--noorix-red-8)',
              color: 'var(--noorix-accent-red)',
            }}
          >
            {st.formError}
          </div>
        )}
        {!st.confirmStep && mode === 'increase' && compensationSnapshotsError && (
          <div
            className="mb-4 p-3 rounded-lg text-[14px]"
            style={{
              background: 'var(--noorix-red-8)',
              color: 'var(--noorix-accent-red)',
            }}
          >
            {compensationSnapshotsError instanceof Error ? compensationSnapshotsError.message : t('loadingError')}
          </div>
        )}
        {!st.confirmStep && !dataLoading && mode === 'advance' && (
          <HrQuickEntryAdvanceForm
            t={t}
            isAr={isAr}
            vaults={st.vaults}
            advEmp={st.advEmp}
            setAdvEmp={st.setAdvEmp}
            advAmount={st.advAmount}
            setAdvAmount={st.setAdvAmount}
            advVault={st.advVault}
            setAdvVault={st.setAdvVault}
            advDate={st.advDate}
            setAdvDate={st.setAdvDate}
            advNotes={st.advNotes}
            setAdvNotes={st.setAdvNotes}
            submitting={submitting}
            onClose={onClose}
            onSubmit={actions.onSubmitAdvance}
            empSelect={empSelect}
          />
        )}
        {!st.confirmStep && !dataLoading && mode === 'leave' && (
          <HrQuickEntryLeaveForm
            t={t}
            isAr={isAr}
            lvEmp={st.lvEmp}
            setLvEmp={st.setLvEmp}
            lvType={st.lvType}
            setLvType={st.setLvType}
            lvStart={st.lvStart}
            setLvStart={st.setLvStart}
            lvEnd={st.lvEnd}
            setLvEnd={st.setLvEnd}
            lvDays={st.lvDays}
            setLvDays={st.setLvDays}
            lvNotes={st.lvNotes}
            setLvNotes={st.setLvNotes}
            submitting={submitting}
            onClose={onClose}
            onSubmit={actions.onSubmitLeave}
            empSelect={empSelect}
          />
        )}
        {!st.confirmStep && !dataLoading && mode === 'deduction' && (
          <HrQuickEntryDeductionForm
            t={t}
            isAr={isAr}
            ddEmp={st.ddEmp}
            setDdEmp={st.setDdEmp}
            ddType={st.ddType}
            setDdType={st.setDdType}
            ddAmount={st.ddAmount}
            setDdAmount={st.setDdAmount}
            ddDate={st.ddDate}
            setDdDate={st.setDdDate}
            ddNotes={st.ddNotes}
            setDdNotes={st.setDdNotes}
            submitting={submitting}
            onClose={onClose}
            onSubmit={actions.onSubmitDeduction}
            empSelect={empSelect}
          />
        )}
        {!st.confirmStep && !dataLoading && mode === 'increase' && (
          <HrQuickEntryIncreaseForm
            t={t}
            isAr={isAr}
            incTab={st.incTab}
            setIncTab={st.setIncTab}
            setFormError={st.setFormError}
            mvEmp={st.mvEmp}
            setMvEmp={st.setMvEmp}
            mvType={st.mvType}
            setMvType={st.setMvType}
            mvAmount={st.mvAmount}
            setMvAmount={st.setMvAmount}
            mvPrev={st.mvPrev}
            setMvPrev={st.setMvPrev}
            mvNew={st.mvNew}
            setMvNew={st.setMvNew}
            mvEff={st.mvEff}
            setMvEff={st.setMvEff}
            mvNotes={st.mvNotes}
            setMvNotes={st.setMvNotes}
            alEmp={st.alEmp}
            setAlEmp={st.setAlEmp}
            alName={st.alName}
            setAlName={st.setAlName}
            alAmount={st.alAmount}
            setAlAmount={st.setAlAmount}
            submitting={submitting}
            onClose={onClose}
            onSubmitMovement={actions.onSubmitMovement}
            onSubmitAllowance={actions.onSubmitAllowance}
            empSelect={empSelect}
            movementSectionLabel={isAr ? t('chatMovementSection') : 'Promotion / raise'}
            allowanceSectionLabel={isAr ? t('chatAllowanceSection') : 'Allowance'}
          />
        )}
      </HrQuickEntryTable>
    </AdaptiveSheet>
  );
}

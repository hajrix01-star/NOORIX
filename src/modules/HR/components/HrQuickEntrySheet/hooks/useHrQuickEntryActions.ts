import { useCallback } from 'react';
import type { Dispatch, FormEvent, SetStateAction } from 'react';
import { roundMoney2 } from '../../../../../utils/moneyInput';
import type { EmployeeOption, HrQuickEntryRecordedPayload } from '../types';
import {
  buildAdvancePending,
  buildAllowancePending,
  buildDeductionPending,
  buildLeavePending,
  buildMovementPending,
} from '../utils/hrQuickEntryMappers';

type TFn = (key: string, ...subst: string[]) => string;

type StateSlice = {
  advEmp: string;
  advAmount: string;
  advVault: string;
  advDate: string;
  advNotes: string;
  lvEmp: string;
  lvType: string;
  lvStart: string;
  lvEnd: string;
  lvDays: string;
  lvNotes: string;
  ddEmp: string;
  ddType: string;
  ddAmount: string;
  ddDate: string;
  ddNotes: string;
  mvEmp: string;
  mvType: string;
  mvAmount: string;
  mvPrev: string;
  mvNew: string;
  mvEff: string;
  mvNotes: string;
  alEmp: string;
  alName: string;
  alAmount: string;
};

type MutRef = { mutate: (v: { payload: unknown; report: HrQuickEntryRecordedPayload }) => void };

type Pending = {
  payload: unknown;
  report: HrQuickEntryRecordedPayload;
  mut: MutRef;
} | null;

export function useHrQuickEntryActions(args: {
  companyId: string;
  isAr: boolean;
  t: TFn;
  submitting: boolean;
  activeEmployees: EmployeeOption[];
  vaults: Array<{ id?: string; nameAr?: string; nameEn?: string }>;
  st: StateSlice;
  advMut: MutRef;
  leaveMut: MutRef;
  dedMut: MutRef;
  movMut: MutRef;
  alMut: MutRef;
  pendingData: Pending;
  setFormError: (s: string) => void;
  setConfirmStep: (v: boolean) => void;
  setPendingData: Dispatch<SetStateAction<Pending>>;
}) {
  const {
    companyId,
    isAr,
    t,
    submitting,
    activeEmployees,
    vaults,
    st,
    advMut,
    leaveMut,
    dedMut,
    movMut,
    alMut,
    pendingData,
    setFormError,
    setConfirmStep,
    setPendingData,
  } = args;

  const onSubmitAdvance = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setFormError('');
      const amt = parseFloat(String(st.advAmount).replace(',', '.'));
      if (!st.advEmp || !amt || amt <= 0) {
        setFormError(t('requiredFields'));
        return;
      }
      if (vaults.length === 0) {
        setFormError(isAr ? 'لا توجد خزائن. أضف خزنة من الخزائن أولاً.' : 'No vaults. Add a vault first.');
        return;
      }
      const { payload, report } = buildAdvancePending({
        advEmp: st.advEmp,
        advAmount: st.advAmount,
        advVault: st.advVault,
        advDate: st.advDate,
        advNotes: st.advNotes,
        companyId,
        activeEmployees,
        vaults,
      });
      setPendingData({ payload, report, mut: advMut });
      setConfirmStep(true);
    },
    [submitting, st, activeEmployees, vaults, companyId, isAr, t, advMut, setFormError, setPendingData, setConfirmStep],
  );

  const onSubmitLeave = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setFormError('');
      if (!st.lvEmp || !st.lvStart || !st.lvEnd) {
        setFormError(t('requiredFields'));
        return;
      }
      const s = new Date(st.lvStart);
      const end = new Date(st.lvEnd);
      if (end < s) {
        setFormError(t('endDateBeforeStart'));
        return;
      }
      const { payload, report } = buildLeavePending({
        lvEmp: st.lvEmp,
        lvType: st.lvType,
        lvStart: st.lvStart,
        lvEnd: st.lvEnd,
        lvDays: st.lvDays,
        lvNotes: st.lvNotes,
        companyId,
        activeEmployees,
      });
      setPendingData({ payload, report, mut: leaveMut });
      setConfirmStep(true);
    },
    [submitting, st, activeEmployees, companyId, t, leaveMut, setFormError, setPendingData, setConfirmStep],
  );

  const onSubmitDeduction = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setFormError('');
      const amt = parseFloat(String(st.ddAmount).replace(',', '.'));
      if (!st.ddEmp || !amt || amt <= 0) {
        setFormError(t('requiredFields'));
        return;
      }
      const { payload, report } = buildDeductionPending({
        ddEmp: st.ddEmp,
        ddType: st.ddType,
        ddAmount: st.ddAmount,
        ddDate: st.ddDate,
        ddNotes: st.ddNotes,
        companyId,
        activeEmployees,
      });
      setPendingData({ payload, report, mut: dedMut });
      setConfirmStep(true);
    },
    [submitting, st, activeEmployees, companyId, t, dedMut, setFormError, setPendingData, setConfirmStep],
  );

  const onSubmitMovement = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setFormError('');
      if (!st.mvEmp || !st.mvEff) {
        setFormError(t('requiredFields'));
        return;
      }
      const { payload, report } = buildMovementPending({
        mvEmp: st.mvEmp,
        mvType: st.mvType,
        mvAmount: st.mvAmount,
        mvPrev: st.mvPrev,
        mvNew: st.mvNew,
        mvEff: st.mvEff,
        mvNotes: st.mvNotes,
        companyId,
        activeEmployees,
      });
      setPendingData({ payload, report, mut: movMut });
      setConfirmStep(true);
    },
    [submitting, st, activeEmployees, companyId, t, movMut, setFormError, setPendingData, setConfirmStep],
  );

  const onSubmitAllowance = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setFormError('');
      const amt = parseFloat(String(st.alAmount).replace(',', '.'));
      const amtRounded = roundMoney2(amt);
      if (!st.alEmp || !st.alName.trim() || !amtRounded || amtRounded <= 0) {
        setFormError(t('requiredFields'));
        return;
      }
      const { payload, report } = buildAllowancePending({
        alEmp: st.alEmp,
        alName: st.alName,
        alAmount: st.alAmount,
        companyId,
        activeEmployees,
      });
      setPendingData({ payload, report, mut: alMut });
      setConfirmStep(true);
    },
    [submitting, st, activeEmployees, companyId, t, alMut, setFormError, setPendingData, setConfirmStep],
  );

  const handleConfirmSave = useCallback(() => {
    if (!pendingData || submitting) return;
    const { payload, report, mut } = pendingData;
    mut.mutate({ payload, report });
  }, [pendingData, submitting]);

  return {
    onSubmitAdvance,
    onSubmitLeave,
    onSubmitDeduction,
    onSubmitMovement,
    onSubmitAllowance,
    handleConfirmSave,
  };
}

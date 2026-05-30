import { useCallback } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApiMutation } from '../../../../../hooks/useApiMutation';
import { createLeave, createDeduction, createMovement, createCustomAllowance, createAdvance } from '../../../../../services/api';
import { invalidateOnFinancialMutation } from '../../../../../utils/queryInvalidation';
import { invalidateHrQueries } from '../utils/hrQuickEntryInvalidation';
import { applyCareerPromotion, applyCareerRaise } from '../../../utils/careerMovementApply';
import type { HrQuickEntryRecordedPayload } from '../types';

type Deps = {
  companyId: string;
  onCloseRef: MutableRefObject<(() => void) | undefined>;
  onRecorded?: (o: HrQuickEntryRecordedPayload) => void;
  setFormError: (s: string) => void;
  setConfirmStep: (v: boolean) => void;
  setPendingData: Dispatch<
    SetStateAction<{
      payload: unknown;
      report: HrQuickEntryRecordedPayload;
      mut: { mutate: (v: { payload: unknown; report: HrQuickEntryRecordedPayload }) => void };
    } | null>
  >;
};

export function useHrQuickEntryMutations({
  companyId,
  onCloseRef,
  onRecorded,
  setFormError,
  setConfirmStep,
  setPendingData,
}: Deps) {
  const qc = useQueryClient();

  const closeOnSuccess = useCallback(
    (variables: unknown, fallbackReport: HrQuickEntryRecordedPayload) => {
      setConfirmStep(false);
      setPendingData(null);
      const r =
        typeof variables === 'object' &&
        variables !== null &&
        'report' in variables &&
        (variables as { report?: HrQuickEntryRecordedPayload }).report;
      onRecorded?.(r || fallbackReport);
      onCloseRef.current?.();
    },
    [onRecorded, setConfirmStep, setPendingData],
  );

  const advMut = useApiMutation({
    mutationFn: async (arg: { payload: unknown; report: HrQuickEntryRecordedPayload }) => {
      const p = (arg as { payload?: unknown })?.payload ?? arg;
      return createAdvance(p as never);
    },
    showErrorToast: false,
    onSuccess: (_: unknown, variables: { payload: unknown; report: HrQuickEntryRecordedPayload }) => {
      invalidateOnFinancialMutation(qc);
      invalidateHrQueries(qc, companyId);
      closeOnSuccess(variables, { textAr: 'تم تسجيل السلفة.', textEn: 'Advance recorded.' });
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : String(e)),
  });

  const leaveMut = useApiMutation({
    mutationFn: async (arg: { payload: unknown; report: HrQuickEntryRecordedPayload }) => {
      const body = (arg as { payload?: unknown })?.payload ?? arg;
      return createLeave(body as never);
    },
    showErrorToast: false,
    onSuccess: (_: unknown, variables: { payload: unknown; report: HrQuickEntryRecordedPayload }) => {
      invalidateHrQueries(qc, companyId);
      closeOnSuccess(variables, { textAr: 'تم تسجيل الإجازة.', textEn: 'Leave recorded.' });
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : String(e)),
  });

  const dedMut = useApiMutation({
    mutationFn: async (arg: { payload: unknown; report: HrQuickEntryRecordedPayload }) => {
      const body = (arg as { payload?: unknown })?.payload ?? arg;
      return createDeduction(body as never);
    },
    showErrorToast: false,
    onSuccess: (_: unknown, variables: { payload: unknown; report: HrQuickEntryRecordedPayload }) => {
      invalidateHrQueries(qc, companyId);
      closeOnSuccess(variables, { textAr: 'تم تسجيل الخصم.', textEn: 'Deduction recorded.' });
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : String(e)),
  });

  const movMut = useApiMutation({
    mutationFn: async (arg: { payload: unknown; report: HrQuickEntryRecordedPayload }) => {
      const body = ((arg as { payload?: unknown })?.payload ?? arg) as Record<string, unknown>;
      const applyMode = body._applyMode as string | undefined;
      if (applyMode === 'raise') {
        return applyCareerRaise({
          employee: body.employee as Record<string, unknown> & { id?: string },
          companyId: String(body.companyId || companyId),
          customAllowances: (body.customAllowances as never[]) || [],
          increment: Number(body.increment),
          effectiveDate: String(body.effectiveDate),
          notes: body.notes ? String(body.notes) : undefined,
        });
      }
      if (applyMode === 'promotion') {
        return applyCareerPromotion({
          employee: body.employee as Record<string, unknown> & { id?: string; jobTitle?: string },
          companyId: String(body.companyId || companyId),
          newJobTitle: String(body.newJobTitle || ''),
          previousJobTitle: body.previousJobTitle ? String(body.previousJobTitle) : undefined,
          effectiveDate: String(body.effectiveDate),
          notes: body.notes ? String(body.notes) : undefined,
        });
      }
      return createMovement(body as never);
    },
    showErrorToast: false,
    onSuccess: (_: unknown, variables: { payload: unknown; report: HrQuickEntryRecordedPayload }) => {
      invalidateHrQueries(qc, companyId);
      closeOnSuccess(variables, {
        textAr: 'تم تسجيل الزيادة أو الترقية.',
        textEn: 'Promotion or raise recorded.',
      });
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : String(e)),
  });

  const alMut = useApiMutation({
    mutationFn: async (arg: { payload: unknown; report: HrQuickEntryRecordedPayload }) => {
      const body = (arg as { payload?: unknown })?.payload ?? arg;
      return createCustomAllowance(body as never);
    },
    showErrorToast: false,
    onSuccess: (_: unknown, variables: { payload: unknown; report: HrQuickEntryRecordedPayload }) => {
      invalidateHrQueries(qc, companyId);
      closeOnSuccess(variables, { textAr: 'تم تسجيل البدلة الإضافية.', textEn: 'Allowance recorded.' });
    },
    onError: (e: unknown) => setFormError(e instanceof Error ? e.message : String(e)),
  });

  const submitting =
    advMut.isPending ||
    leaveMut.isPending ||
    dedMut.isPending ||
    movMut.isPending ||
    alMut.isPending;

  return {
    advMut,
    leaveMut,
    dedMut,
    movMut,
    alMut,
    submitting,
  };
}

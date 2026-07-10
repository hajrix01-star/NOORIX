/**
 * EmployeeCareerMovementModal — تسجيل ترقية أو زيادة راتب من ملف الموظف (مع تحديث السجل والبيانات الحالية).
 * زيادة الراتب: تُطبَّق على الإجمالي الشهري شاملاً الأوفر تايم؛ يُستنتج الراتب الأساسي كما في حاسبة الرواتب.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { DateField, DialogActions, Input, AdaptiveSheet , FmtNum } from '../../../ui';
import { getSaudiToday, toDateInputYmd } from '../../../utils/saudiDate';
import { roundMoney2 } from '../../../utils/moneyInput';
import { createMovement, updateEmployee, updateRaiseMovement, throwIfApiFailed } from '../../../services/api';
import { hrFmt } from '../utils/hrFmt';
import {
  basicSalaryFromTargetTotalInclusiveOvertime,
} from '../utils/employeeSalaryMath';
import type { HrEmployee } from '../../../types/api';

type CareerMovementKind = 'promotion' | 'raise';
type CareerMovementRecord = {
  id?: string | null;
  effectiveDate?: string | Date | null;
  amount?: number | string | null;
  previousValue?: number | string | null;
  notes?: string | null;
};
type EmployeeCareerMovementModalProps = {
  kind: CareerMovementKind | string | null;
  employee: HrEmployee | null;
  companyId: string;
  customAllowanceTotal?: number;
  currentTotalAllIn?: number;
  editMovement?: CareerMovementRecord | null;
  onClose: () => void;
  onSuccess?: () => void;
};
type CareerInputChange = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function EmployeeCareerMovementModal({
  kind,
  employee,
  companyId,
  customAllowanceTotal = 0,
  currentTotalAllIn,
  editMovement = null,
  onClose,
  onSuccess,
}: EmployeeCareerMovementModalProps) {
  const { t } = useTranslation();
  const isEditRaise = !!editMovement && kind === 'raise';
  const [effectiveDate, setEffectiveDate] = useState(getSaudiToday());
  const [prevJobTitle, setPrevJobTitle] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [raiseIncrement, setRaiseIncrement] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const customTotal = Number(customAllowanceTotal);
  const centralCurrentTotalAllIn = Number(currentTotalAllIn);
  const hasCentralCurrentTotal =
    Number.isFinite(centralCurrentTotalAllIn) &&
    centralCurrentTotalAllIn > 0 &&
    Number.isFinite(customTotal);

  useEffect(() => {
    if (!employee) return;
    if (isEditRaise && editMovement) {
      setEffectiveDate(toDateInputYmd(editMovement.effectiveDate));
      setRaiseIncrement(
        editMovement.amount != null && String(editMovement.amount).trim() !== ''
          ? String(editMovement.amount)
          : '',
      );
      setNotes(editMovement.notes || '');
    } else {
      setEffectiveDate(getSaudiToday());
      setPrevJobTitle(employee.jobTitle || '');
      setNewJobTitle('');
      setRaiseIncrement('');
      setNotes('');
    }
    setFormError('');
  }, [employee, kind, isEditRaise, editMovement]);

  const raisePreview = useMemo(() => {
    if (kind !== 'raise' || !employee) return null;
    const raw = String(raiseIncrement ?? '').trim().replace(',', '.');
    if (raw === '' || raw === '-' || raw === '+') return null;
    const inc = roundMoney2(raw);
    if (!Number.isFinite(inc) || inc === 0) return null;

    const baseTotal = isEditRaise && editMovement?.previousValue != null
      ? roundMoney2(Number(editMovement.previousValue))
      : centralCurrentTotalAllIn;

    const newTarget = roundMoney2(baseTotal + inc);
    if (newTarget <= 0) return { invalidTarget: true, inc, newTarget };
    const { basic, inverseWarning } = basicSalaryFromTargetTotalInclusiveOvertime(
      employee,
      customTotal,
      newTarget,
    );
    return {
      inc,
      newTarget,
      basic,
      inverseWarning,
      baseTotal,
    };
  }, [kind, employee, customTotal, raiseIncrement, centralCurrentTotalAllIn, isEditRaise, editMovement]);

  async function handleSubmit(e: React.FormEvent) {
    e?.preventDefault?.();
    if (!employee?.id || !companyId || saving) return;
    setFormError('');

    if (kind === 'promotion') {
      const nextTitle = newJobTitle.trim();
      if (!nextTitle) {
        setFormError(t('requiredFields'));
        return;
      }
      setSaving(true);
      try {
        const up = await updateEmployee(employee.id, { jobTitle: nextTitle }, companyId);
        throwIfApiFailed(up, t('updateFailed'));
        const prev = prevJobTitle.trim();
        const mov = await createMovement({
          companyId,
          employeeId: employee.id,
          movementType: 'promotion',
          previousValue: prev || undefined,
          newValue: nextTitle,
          effectiveDate: `${effectiveDate}T12:00:00.000Z`,
          notes: notes.trim() || undefined,
        });
        throwIfApiFailed(mov, t('saveFailed'));
        onSuccess?.();
        onClose?.();
      } catch (err: unknown) {
        setFormError(getErrorMessage(err, t('saveFailed')));
      } finally {
        setSaving(false);
      }
      return;
    }

    const raw = String(raiseIncrement ?? '').trim().replace(',', '.');
    const inc = roundMoney2(raw);
    if (!Number.isFinite(inc) || inc === 0) {
      setFormError(t('careerRaiseIncrementNonZero'));
      return;
    }
    if (!hasCentralCurrentTotal) {
      setFormError(t('loadingError'));
      return;
    }
    const baseTotal = isEditRaise && editMovement?.previousValue != null
      ? roundMoney2(Number(editMovement.previousValue))
      : centralCurrentTotalAllIn;
    const newTarget = roundMoney2(baseTotal + inc);
    if (newTarget <= 0) {
      setFormError(t('careerRaiseNewTargetInvalid'));
      return;
    }
    const { basic, inverseWarning } = basicSalaryFromTargetTotalInclusiveOvertime(
      employee,
      customTotal,
      newTarget,
    );
    if (!isEditRaise && (inverseWarning || basic <= 0)) {
      setFormError(t('careerInverseSalaryWarn'));
      return;
    }
    if (isEditRaise && inverseWarning) {
      setFormError(t('careerInverseSalaryWarn'));
      return;
    }

    setSaving(true);
    try {
      if (isEditRaise && editMovement?.id) {
        const mov = await updateRaiseMovement(editMovement.id, companyId, {
          increment: inc,
          effectiveDate: `${effectiveDate}T12:00:00.000Z`,
          notes: notes.trim() || undefined,
        });
        throwIfApiFailed(mov, t('saveFailed'));
        onSuccess?.();
        onClose?.();
        return;
      }

      const mov = await createMovement({
        companyId,
        employeeId: employee.id,
        movementType: 'raise',
        amount: inc > 0 ? inc : undefined,
        previousValue: String(roundMoney2(centralCurrentTotalAllIn)),
        newValue: String(roundMoney2(newTarget)),
        effectiveDate: `${effectiveDate}T12:00:00.000Z`,
        notes:
          notes.trim()
          || (inc < 0
            ? `${t('careerSalaryAdjustmentNote')}: ${hrFmt(centralCurrentTotalAllIn)} → ${hrFmt(newTarget)}`
            : undefined),
      });
      throwIfApiFailed(mov, t('saveFailed'));
      onSuccess?.();
      onClose?.();
    } catch (err: unknown) {
      setFormError(getErrorMessage(err, t('saveFailed')));
    } finally {
      setSaving(false);
    }
  }

  const title = isEditRaise
    ? t('careerEditRaise')
    : kind === 'promotion'
      ? t('careerRegisterPromotion')
      : t('careerRegisterRaise');

  const raiseBlocked =
    kind === 'raise'
    && (!hasCentralCurrentTotal || raisePreview?.invalidTarget || raisePreview?.inverseWarning);

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={title}
      size="md"
      side="start"
      footer={
        <DialogActions
          actions={[
            { key: 'cancel', label: t('cancel'), role: 'cancel', disabled: saving, onClick: onClose },
            {
              key: 'save-movement',
              label: saving ? t('saving') : t('careerSaveMovement'),
              role: 'save',
              disabled: saving || raiseBlocked,
              onClick: handleSubmit,
            },
          ]}
        />
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError ? (
          <div className="text-[13px] text-noorix-red rounded-lg px-3 py-2 bg-noorix-bg-muted border border-noorix-border">
            {formError}
          </div>
        ) : null}
        {kind === 'raise' && !hasCentralCurrentTotal ? (
          <div className="text-[13px] text-noorix-red rounded-lg px-3 py-2 bg-noorix-bg-muted border border-noorix-border">
            {t('loadingError')}
          </div>
        ) : null}

        <DateField
          label={t('careerEffectiveDate')}
          value={effectiveDate}
          onValueChange={setEffectiveDate}
          lang="en"
        />

        {kind === 'promotion' ? (
          <>
            <Input
              type="text"
              label={t('careerPreviousJobTitle')}
              value={prevJobTitle}
              onChange={(e: CareerInputChange) => setPrevJobTitle(e.target.value)}
              placeholder={t('jobTitlePlaceholder')}
            />
            <Input
              type="text"
              label={t('careerNewJobTitle')}
              value={newJobTitle}
              onChange={(e: CareerInputChange) => setNewJobTitle(e.target.value)}
              placeholder={t('jobTitlePlaceholder')}
              required
            />
          </>
        ) : (
          <>
            <div className="text-[13px] text-noorix-muted">
              {isEditRaise ? t('careerRaiseEditBaseHint') : t('careerCurrentTotalWithOvertime')}:{' '}
              <span className="font-semibold text-noorix-text ltr inline-block">
                {hrFmt(isEditRaise && raisePreview?.baseTotal != null ? raisePreview.baseTotal : centralCurrentTotalAllIn)}
              </span>
            </div>
            <p className="text-[12px] text-noorix-muted m-0 -mt-2">{t('careerRaiseTotalHint')}</p>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              label={t('careerRaiseIncrementOnTotal')}
              value={raiseIncrement}
              onChange={(e: CareerInputChange) => setRaiseIncrement(e.target.value)}
              placeholder="0"
            />
            {raisePreview?.invalidTarget ? (
              <div className="text-[12px] text-noorix-red">{t('careerRaiseNewTargetInvalid')}</div>
            ) : null}
            {raisePreview && !raisePreview.invalidTarget && raisePreview.inverseWarning ? (
              <div className="text-[12px] text-noorix-amber">{t('careerInverseSalaryWarn')}</div>
            ) : null}
            {raisePreview && !raisePreview.invalidTarget && !raisePreview.inverseWarning ? (
              <div className="text-[13px] rounded-lg px-3 py-2 bg-noorix-bg-muted border border-noorix-border space-y-1">
                <div>
                  <span className="text-noorix-muted">{t('careerRaisePreviewTotal')}: </span>
                  <FmtNum n={raisePreview.newTarget} className="font-semibold text-noorix-text ltr" />
                </div>
                <div className="text-[12px] text-noorix-muted">
                  {t('careerRaiseImpliedBasic')}:{' '}
                  <FmtNum n={raisePreview.basic ?? 0} className="font-medium text-noorix-text ltr" />
                </div>
              </div>
            ) : null}
          </>
        )}

        <Input
          type="text"
          label={t('notes')}
          value={notes}
          onChange={(e: CareerInputChange) => setNotes(e.target.value)}
          placeholder={t('notes')}
        />
      </form>
    </AdaptiveSheet>
  );
}

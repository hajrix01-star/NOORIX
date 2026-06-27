/**
 * EmployeeCareerMovementModal — تسجيل ترقية أو زيادة راتب من ملف الموظف (مع تحديث السجل والبيانات الحالية).
 * زيادة الراتب: تُطبَّق على الإجمالي الشهري شاملاً الأوفر تايم؛ يُستنتج الراتب الأساسي كما في حاسبة الرواتب.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, AdaptiveSheet , FmtNum } from '../../../ui';
import { getSaudiToday, toDateInputYmd } from '../../../utils/saudiDate';
import { roundMoney2 } from '../../../utils/moneyInput';
import { createMovement, updateEmployee, updateRaiseMovement } from '../../../services/api';
import { rejectIfApiFailed } from '../../../utils/apiResponse';
import { hrFmt } from '../utils/hrFmt';
import {
  basicSalaryFromTargetTotalInclusiveOvertime,
  computeEmployeeSalaryPackageBreakdown,
} from '../utils/employeeSalaryMath';

/**
 * @param {{ kind: 'promotion' | 'raise', employee: object, companyId: string, customAllowanceTotal?: number, onClose: () => void, onSuccess?: () => void }} props
 */
export function EmployeeCareerMovementModal({
  kind,
  employee,
  companyId,
  customAllowanceTotal = 0,
  editMovement = null,
  onClose,
  onSuccess,
}: any) {
  const { t } = useTranslation();
  const isEditRaise = !!editMovement && kind === 'raise';
  const [effectiveDate, setEffectiveDate] = useState(getSaudiToday());
  const [prevJobTitle, setPrevJobTitle] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [raiseIncrement, setRaiseIncrement] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const customTotal = Number(customAllowanceTotal) || 0;

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

  const currentTotalAllIn = useMemo(
    () => computeEmployeeSalaryPackageBreakdown(employee, customTotal).total,
    [employee, customTotal],
  );

  const raisePreview = useMemo(() => {
    if (kind !== 'raise' || !employee) return null;
    const raw = String(raiseIncrement ?? '').trim().replace(',', '.');
    if (raw === '' || raw === '-' || raw === '+') return null;
    const inc = roundMoney2(raw);
    if (!Number.isFinite(inc) || inc === 0) return null;

    const baseTotal = isEditRaise && editMovement?.previousValue != null
      ? roundMoney2(Number(editMovement.previousValue))
      : currentTotalAllIn;

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
  }, [kind, employee, customTotal, raiseIncrement, currentTotalAllIn, isEditRaise, editMovement]);

  async function handleSubmit(e: any) {
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
        rejectIfApiFailed(up, t('updateFailed'));
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
        rejectIfApiFailed(mov, t('saveFailed'));
        onSuccess?.();
        onClose?.();
      } catch (err: any) {
        setFormError(err?.message || t('saveFailed'));
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
    const baseTotal = isEditRaise && editMovement?.previousValue != null
      ? roundMoney2(Number(editMovement.previousValue))
      : currentTotalAllIn;
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
        rejectIfApiFailed(mov, t('saveFailed'));
        onSuccess?.();
        onClose?.();
        return;
      }

      const up = await updateEmployee(employee.id, { basicSalary: basic }, companyId);
      rejectIfApiFailed(up, t('updateFailed'));
      const mov = await createMovement({
        companyId,
        employeeId: employee.id,
        movementType: 'raise',
        amount: inc > 0 ? inc : undefined,
        previousValue: String(roundMoney2(currentTotalAllIn)),
        newValue: String(roundMoney2(newTarget)),
        effectiveDate: `${effectiveDate}T12:00:00.000Z`,
        notes:
          notes.trim()
          || (inc < 0
            ? `${t('careerSalaryAdjustmentNote')}: ${hrFmt(currentTotalAllIn)} → ${hrFmt(newTarget)}`
            : undefined),
      });
      rejectIfApiFailed(mov, t('saveFailed'));
      onSuccess?.();
      onClose?.();
    } catch (err: any) {
      setFormError(err?.message || t('saveFailed'));
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
    && (raisePreview?.invalidTarget || raisePreview?.inverseWarning);

  return (
    <AdaptiveSheet
      open={true}
      onClose={onClose}
      title={title}
      size="md"
      side="start"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>{t('cancel')}</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={saving || raiseBlocked}>
            {saving ? t('saving') : t('careerSaveMovement')}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {formError ? (
          <div className="text-[13px] text-noorix-red rounded-lg px-3 py-2 bg-noorix-bg-muted border border-noorix-border">
            {formError}
          </div>
        ) : null}

        <Input
          type="date"
          label={t('careerEffectiveDate')}
          value={effectiveDate}
          onChange={(e: any) => setEffectiveDate(e.target.value)}
          lang="en"
        />

        {kind === 'promotion' ? (
          <>
            <Input
              type="text"
              label={t('careerPreviousJobTitle')}
              value={prevJobTitle}
              onChange={(e: any) => setPrevJobTitle(e.target.value)}
              placeholder={t('jobTitlePlaceholder')}
            />
            <Input
              type="text"
              label={t('careerNewJobTitle')}
              value={newJobTitle}
              onChange={(e: any) => setNewJobTitle(e.target.value)}
              placeholder={t('jobTitlePlaceholder')}
              required
            />
          </>
        ) : (
          <>
            <div className="text-[13px] text-noorix-muted">
              {isEditRaise ? t('careerRaiseEditBaseHint') : t('careerCurrentTotalWithOvertime')}:{' '}
              <span className="font-semibold text-noorix-text ltr inline-block">
                {hrFmt(isEditRaise && raisePreview?.baseTotal != null ? raisePreview.baseTotal : currentTotalAllIn)}
              </span>
            </div>
            <p className="text-[12px] text-noorix-muted m-0 -mt-2">{t('careerRaiseTotalHint')}</p>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              label={t('careerRaiseIncrementOnTotal')}
              value={raiseIncrement}
              onChange={(e: any) => setRaiseIncrement(e.target.value)}
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
          onChange={(e: any) => setNotes(e.target.value)}
          placeholder={t('notes')}
        />
      </form>
    </AdaptiveSheet>
  );
}

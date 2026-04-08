/**
 * EmployeeCareerMovementModal — تسجيل ترقية أو زيادة راتب من ملف الموظف (مع تحديث السجل والبيانات الحالية).
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../../i18n/useTranslation';
import { Button, Input, AdaptiveSheet } from '../../../ui';
import { getSaudiToday } from '../../../utils/saudiDate';
import { roundMoney2, moneyAmountsEqual } from '../../../utils/moneyInput';
import { createMovement, updateEmployee } from '../../../services/api';
import { rejectIfApiFailed } from '../../../utils/apiResponse';
import { hrFmt } from '../utils/hrFmt';

/**
 * @param {{ kind: 'promotion' | 'raise', employee: object, companyId: string, onClose: () => void, onSuccess?: () => void }} props
 */
export function EmployeeCareerMovementModal({ kind, employee, companyId, onClose, onSuccess }) {
  const { t } = useTranslation();
  const [effectiveDate, setEffectiveDate] = useState(getSaudiToday());
  const [prevJobTitle, setPrevJobTitle] = useState('');
  const [newJobTitle, setNewJobTitle] = useState('');
  const [newBasicSalary, setNewBasicSalary] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!employee) return;
    setEffectiveDate(getSaudiToday());
    setPrevJobTitle(employee.jobTitle || '');
    setNewJobTitle('');
    setNewBasicSalary('');
    setNotes('');
    setFormError('');
  }, [employee, kind]);

  const currentBasic = roundMoney2(employee?.basicSalary ?? 0);

  async function handleSubmit(e) {
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
      } catch (err) {
        setFormError(err?.message || t('saveFailed'));
      } finally {
        setSaving(false);
      }
      return;
    }

    const newB = roundMoney2(newBasicSalary);
    if (!newB || newB <= 0) {
      setFormError(t('requiredFields'));
      return;
    }
    if (moneyAmountsEqual(newB, currentBasic)) {
      setFormError(t('careerNewBasicMustDiffer'));
      return;
    }

    setSaving(true);
    try {
      const up = await updateEmployee(employee.id, { basicSalary: newB }, companyId);
      rejectIfApiFailed(up, t('updateFailed'));
      const diff = roundMoney2(newB - currentBasic);
      const mov = await createMovement({
        companyId,
        employeeId: employee.id,
        movementType: 'raise',
        amount: diff > 0 ? diff : undefined,
        previousValue: String(currentBasic),
        newValue: String(newB),
        effectiveDate: `${effectiveDate}T12:00:00.000Z`,
        notes: notes.trim() || (diff < 0 ? `${t('careerSalaryAdjustmentNote')}: ${hrFmt(currentBasic)} → ${hrFmt(newB)}` : undefined),
      });
      rejectIfApiFailed(mov, t('saveFailed'));
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setFormError(err?.message || t('saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  const title = kind === 'promotion' ? t('careerRegisterPromotion') : t('careerRegisterRaise');

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
          <Button variant="primary" onClick={handleSubmit} disabled={saving}>
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
          onChange={(e) => setEffectiveDate(e.target.value)}
          lang="en"
        />

        {kind === 'promotion' ? (
          <>
            <Input
              type="text"
              label={t('careerPreviousJobTitle')}
              value={prevJobTitle}
              onChange={(e) => setPrevJobTitle(e.target.value)}
              placeholder={t('jobTitlePlaceholder')}
            />
            <Input
              type="text"
              label={t('careerNewJobTitle')}
              value={newJobTitle}
              onChange={(e) => setNewJobTitle(e.target.value)}
              placeholder={t('jobTitlePlaceholder')}
              required
            />
          </>
        ) : (
          <>
            <div className="text-[13px] text-noorix-muted">
              {t('careerCurrentBasic')}: <span className="font-semibold text-noorix-text ltr inline-block">{hrFmt(currentBasic)}</span>
            </div>
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              label={t('careerNewBasicSalary')}
              value={newBasicSalary}
              onChange={(e) => setNewBasicSalary(e.target.value)}
              placeholder="0"
            />
          </>
        )}

        <Input
          type="text"
          label={t('notes')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notes')}
        />
      </form>
    </AdaptiveSheet>
  );
}

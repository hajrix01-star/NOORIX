import React from 'react';
import { Button, Input } from '../../../../../ui';
import { HrQuickEntryRow } from './HrQuickEntryRow';
import { HrQuickEntryToolbar } from './HrQuickEntryToolbar';

type TFn = (key: string, ...subst: string[]) => string;

export function HrQuickEntryIncreaseForm(props: {
  t: TFn;
  isAr: boolean;
  incTab: string;
  setIncTab: (v: string) => void;
  setFormError: (s: string) => void;
  mvEmp: string;
  setMvEmp: (v: string) => void;
  mvType: string;
  setMvType: (v: string) => void;
  mvAmount: string;
  setMvAmount: (v: string) => void;
  mvPrev: string;
  setMvPrev: (v: string) => void;
  mvNew: string;
  setMvNew: (v: string) => void;
  mvEff: string;
  setMvEff: (v: string) => void;
  mvNotes: string;
  setMvNotes: (v: string) => void;
  alEmp: string;
  setAlEmp: (v: string) => void;
  alName: string;
  setAlName: (v: string) => void;
  alAmount: string;
  setAlAmount: (v: string) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmitMovement: (e: React.FormEvent) => void;
  onSubmitAllowance: (e: React.FormEvent) => void;
  empSelect: (value: string, onChange: (v: string) => void, id: string) => React.ReactNode;
  movementSectionLabel: string;
  allowanceSectionLabel: string;
}) {
  const {
    t,
    isAr,
    incTab,
    setIncTab,
    setFormError,
    mvEmp,
    setMvEmp,
    mvType,
    setMvType,
    mvAmount,
    setMvAmount,
    mvPrev,
    setMvPrev,
    mvNew,
    setMvNew,
    mvEff,
    setMvEff,
    mvNotes,
    setMvNotes,
    alEmp,
    setAlEmp,
    alName,
    setAlName,
    alAmount,
    setAlAmount,
    submitting,
    onClose,
    onSubmitMovement,
    onSubmitAllowance,
    empSelect,
    movementSectionLabel,
    allowanceSectionLabel,
  } = props;

  return (
    <div>
      <HrQuickEntryToolbar
        movementLabel={movementSectionLabel}
        allowanceLabel={allowanceSectionLabel}
        activeTab={incTab}
        onTab={setIncTab}
        onClearError={() => setFormError('')}
      />

      {incTab === 'movement' ? (
        <form onSubmit={onSubmitMovement}>
          <HrQuickEntryRow id="mv-emp" label={t('selectEmployee')}>
            {empSelect(mvEmp, setMvEmp, 'mv-emp')}
          </HrQuickEntryRow>
          <HrQuickEntryRow id="mv-type" label={isAr ? t('movementTypeLabel') : 'Type'}>
            <Input id="mv-type" type="select" value={mvType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMvType(e.target.value)}>
              <option value="raise">{isAr ? 'زيادة' : 'Raise'}</option>
              <option value="promotion">{isAr ? 'ترقية' : 'Promotion'}</option>
              <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
            </Input>
          </HrQuickEntryRow>
          <HrQuickEntryRow id="mv-amt" label={isAr ? 'مبلغ الزيادة على الإجمالي' : 'Raise on monthly total'}>
            <Input
              id="mv-amt"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={mvAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMvAmount(e.target.value)}
              required={mvType === 'raise'}
            />
          </HrQuickEntryRow>
          {mvType === 'raise' ? (
            <HrQuickEntryRow id="mv-new" label={isAr ? 'أو الإجمالي الجديد' : 'Or new total salary'}>
              <Input
                id="mv-new"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={mvNew}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMvNew(e.target.value)}
                placeholder={isAr ? 'مثال: 9000' : 'e.g. 9000'}
              />
            </HrQuickEntryRow>
          ) : (
            <>
              <HrQuickEntryRow id="mv-prev" label={isAr ? t('previousValue') : 'Previous'}>
                <Input id="mv-prev" type="text" value={mvPrev} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMvPrev(e.target.value)} />
              </HrQuickEntryRow>
              <HrQuickEntryRow id="mv-new" label={isAr ? (mvType === 'promotion' ? 'المسمى الجديد' : t('newValue')) : (mvType === 'promotion' ? 'New job title' : 'New value')}>
                <Input
                  id="mv-new"
                  type="text"
                  value={mvNew}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMvNew(e.target.value)}
                  placeholder={mvType === 'promotion' ? (isAr ? 'مثال: مشرف' : 'e.g. Supervisor') : (isAr ? 'مثال: 8000 → 9000' : 'e.g. 8000 → 9000')}
                  required={mvType === 'promotion'}
                />
              </HrQuickEntryRow>
            </>
          )}
          <HrQuickEntryRow id="mv-eff" label={isAr ? t('effectiveDateLabel') : 'Effective date'}>
            <Input
              id="mv-eff"
              type="date"
              value={mvEff}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMvEff(e.target.value)}
              style={{ direction: 'ltr' }}
              lang="en"
              required
            />
          </HrQuickEntryRow>
          <HrQuickEntryRow id="mv-notes" label={t('notes')}>
            <Input id="mv-notes" type="text" value={mvNotes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMvNotes(e.target.value)} />
          </HrQuickEntryRow>
          <div className="flex gap-3 mt-5">
            <Button onClick={onClose} className="flex-1 min-h-[50px]">
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} className="flex-1 min-h-[50px]">
              {submitting ? t('saving') : isAr ? 'حفظ' : 'Save'}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={onSubmitAllowance}>
          <HrQuickEntryRow id="al-emp" label={t('selectEmployee')}>
            {empSelect(alEmp, setAlEmp, 'al-emp')}
          </HrQuickEntryRow>
          <HrQuickEntryRow id="al-name" label={t('customAllowanceName')}>
            <Input
              id="al-name"
              type="text"
              value={alName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAlName(e.target.value)}
              placeholder={isAr ? 'مثال: بدل طبيعة عمل' : 'e.g. Field allowance'}
            />
          </HrQuickEntryRow>
          <HrQuickEntryRow id="al-amt" label={t('customAllowanceAmount')}>
            <Input
              id="al-amt"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={alAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAlAmount(e.target.value)}
            />
          </HrQuickEntryRow>
          <div className="flex gap-3 mt-5">
            <Button onClick={onClose} className="flex-1 min-h-[50px]">
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting} className="flex-1 min-h-[50px]">
              {submitting ? t('saving') : isAr ? 'حفظ البدلة' : 'Save allowance'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

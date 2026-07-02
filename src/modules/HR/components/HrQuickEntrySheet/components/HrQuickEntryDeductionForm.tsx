import React from 'react';
import { Button, Input } from '../../../../../ui';
import { HrQuickEntryRow } from './HrQuickEntryRow';

type TFn = (key: string, ...subst: string[]) => string;

export function HrQuickEntryDeductionForm(props: {
  t: TFn;
  isAr: boolean;
  ddEmp: string;
  setDdEmp: (v: string) => void;
  ddType: string;
  setDdType: (v: string) => void;
  ddAmount: string;
  setDdAmount: (v: string) => void;
  ddDate: string;
  setDdDate: (v: string) => void;
  ddNotes: string;
  setDdNotes: (v: string) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  empSelect: (value: string, onChange: (v: string) => void, id: string) => React.ReactNode;
}) {
  const {
    t,
    isAr,
    ddEmp,
    setDdEmp,
    ddType,
    setDdType,
    ddAmount,
    setDdAmount,
    ddDate,
    setDdDate,
    ddNotes,
    setDdNotes,
    submitting,
    onClose,
    onSubmit,
    empSelect,
  } = props;

  return (
    <form onSubmit={onSubmit}>
      <HrQuickEntryRow id="dd-emp" label={t('selectEmployee')}>
        {empSelect(ddEmp, setDdEmp, 'dd-emp')}
      </HrQuickEntryRow>
      <HrQuickEntryRow id="dd-type" label={isAr ? 'نوع الخصم' : 'Deduction type'}>
        <Input id="dd-type" type="select" value={ddType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDdType(e.target.value)}>
          <option value="penalty">{isAr ? 'جزاء' : 'Penalty'}</option>
          <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
          <option value="advance">{isAr ? 'مرتبط بسلفة' : 'Advance-related'}</option>
        </Input>
      </HrQuickEntryRow>
      <HrQuickEntryRow id="dd-amt" label={isAr ? 'مبلغ الخصم' : 'Deduction amount'}>
        <Input
          id="dd-amt"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={ddAmount}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDdAmount(e.target.value)}
        />
      </HrQuickEntryRow>
      <HrQuickEntryRow id="dd-date" label={t('transactionDate')}>
        <Input
          id="dd-date"
          type="date"
          value={ddDate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDdDate(e.target.value)}
          dir="ltr"
          lang="en"
        />
      </HrQuickEntryRow>
      <HrQuickEntryRow id="dd-notes" label={t('notes')}>
        <Input
          id="dd-notes"
          type="text"
          value={ddNotes}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDdNotes(e.target.value)}
          placeholder={isAr ? 'السبب' : 'Reason'}
        />
      </HrQuickEntryRow>
      <div className="flex gap-3 mt-5">
        <Button onClick={onClose} className="flex-1 min-h-[50px]">
          {t('cancel')}
        </Button>
        <Button type="submit" variant="primary" disabled={submitting} className="flex-1 min-h-[50px] text-[15px]">
          {submitting ? t('saving') : isAr ? 'حفظ الخصم' : 'Save deduction'}
        </Button>
      </div>
    </form>
  );
}

import React from 'react';
import { vaultDisplayName } from '../../../../../utils/vaultDisplay';
import { Button, Input } from '../../../../../ui';
import { HrQuickEntryRow } from './HrQuickEntryRow';

type TFn = (key: string, ...subst: string[]) => string;

export function HrQuickEntryAdvanceForm(props: {
  t: TFn;
  isAr: boolean;
  vaults: Array<{ id?: string; nameAr?: string; nameEn?: string }>;
  advEmp: string;
  setAdvEmp: (v: string) => void;
  advAmount: string;
  setAdvAmount: (v: string) => void;
  advVault: string;
  setAdvVault: (v: string) => void;
  advDate: string;
  setAdvDate: (v: string) => void;
  advNotes: string;
  setAdvNotes: (v: string) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  empSelect: (value: string, onChange: (v: string) => void, id: string) => React.ReactNode;
}) {
  const {
    t,
    isAr,
    vaults,
    advEmp,
    setAdvEmp,
    advAmount,
    setAdvAmount,
    advVault,
    setAdvVault,
    advDate,
    setAdvDate,
    advNotes,
    setAdvNotes,
    submitting,
    onClose,
    onSubmit,
    empSelect,
  } = props;

  return (
    <form onSubmit={onSubmit}>
      <HrQuickEntryRow id="adv-emp" label={t('selectEmployee')}>
        {empSelect(advEmp, setAdvEmp, 'adv-emp')}
      </HrQuickEntryRow>
      <HrQuickEntryRow id="adv-amt" label={t('advanceAmount')}>
        <Input
          id="adv-amt"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={advAmount}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdvAmount(e.target.value)}
          placeholder="0"
        />
      </HrQuickEntryRow>
      <HrQuickEntryRow id="adv-vault" label={t('selectVault')}>
        <Input
          id="adv-vault"
          type="select"
          value={advVault}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAdvVault(e.target.value)}
          required
        >
          <option value="">{isAr ? '— اختر الخزينة —' : '— Select Vault —'}</option>
          {vaults.map((v) => (
            <option key={v.id} value={v.id}>
              {vaultDisplayName(v, isAr ? 'ar' : 'en')}
            </option>
          ))}
        </Input>
      </HrQuickEntryRow>
      <HrQuickEntryRow id="adv-date" label={t('transactionDate')}>
        <Input
          id="adv-date"
          type="date"
          value={advDate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdvDate(e.target.value)}
          style={{ direction: 'ltr' }}
          lang="en"
        />
      </HrQuickEntryRow>
      <HrQuickEntryRow id="adv-notes" label={t('notes')}>
        <Input
          id="adv-notes"
          type="text"
          value={advNotes}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdvNotes(e.target.value)}
          placeholder={isAr ? 'سبب أو تفاصيل' : 'Reason or details'}
        />
      </HrQuickEntryRow>
      <div className="flex gap-3 mt-5">
        <Button onClick={onClose} className="flex-1 min-h-[50px]">
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          variant="primary"
          disabled={submitting || vaults.length === 0}
          className="flex-1 min-h-[50px] text-[15px]"
        >
          {submitting ? t('saving') : t('payAdvance')}
        </Button>
      </div>
    </form>
  );
}

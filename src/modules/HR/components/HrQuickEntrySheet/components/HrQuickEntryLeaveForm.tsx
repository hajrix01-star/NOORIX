import React from 'react';
import { Button, Input } from '../../../../../ui';
import { HrQuickEntryRow } from './HrQuickEntryRow';
import { TYPE_MAP } from '../constants';

type TFn = (key: string, ...subst: string[]) => string;

export function HrQuickEntryLeaveForm(props: {
  t: TFn;
  isAr: boolean;
  lvEmp: string;
  setLvEmp: (v: string) => void;
  lvType: string;
  setLvType: (v: string) => void;
  lvStart: string;
  setLvStart: (v: string) => void;
  lvEnd: string;
  setLvEnd: (v: string) => void;
  lvDays: string;
  setLvDays: (v: string) => void;
  lvNotes: string;
  setLvNotes: (v: string) => void;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  empSelect: (value: string, onChange: (v: string) => void, id: string) => React.ReactNode;
}) {
  const {
    t,
    lvEmp,
    setLvEmp,
    lvType,
    setLvType,
    lvStart,
    setLvStart,
    lvEnd,
    setLvEnd,
    lvDays,
    setLvDays,
    lvNotes,
    setLvNotes,
    submitting,
    onClose,
    onSubmit,
    empSelect,
  } = props;

  return (
    <form onSubmit={onSubmit}>
      <HrQuickEntryRow id="lv-emp" label={t('selectEmployee')}>
        {empSelect(lvEmp, setLvEmp, 'lv-emp')}
      </HrQuickEntryRow>
      <HrQuickEntryRow id="lv-type" label={t('leaveType')}>
        <Input id="lv-type" type="select" value={lvType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLvType(e.target.value)}>
          {Object.keys(TYPE_MAP).map((k) => (
            <option key={k} value={k}>
              {t((TYPE_MAP as Record<string, string>)[String(k)])}
            </option>
          ))}
        </Input>
      </HrQuickEntryRow>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <HrQuickEntryRow id="lv-start" label={t('startDate')}>
          <Input
            id="lv-start"
            type="date"
            value={lvStart}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLvStart(e.target.value)}
            dir="ltr"
            lang="en"
            required
          />
        </HrQuickEntryRow>
        <HrQuickEntryRow id="lv-end" label={t('endDate')}>
          <Input
            id="lv-end"
            type="date"
            value={lvEnd}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLvEnd(e.target.value)}
            dir="ltr"
            lang="en"
            required
          />
        </HrQuickEntryRow>
      </div>
      <HrQuickEntryRow id="lv-days" label={t('daysCount')}>
        <Input
          id="lv-days"
          type="number"
          inputMode="numeric"
          min="1"
          value={lvDays}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLvDays(e.target.value)}
          placeholder="—"
        />
      </HrQuickEntryRow>
      <HrQuickEntryRow id="lv-notes" label={t('notes')}>
        <Input id="lv-notes" type="text" value={lvNotes} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLvNotes(e.target.value)} />
      </HrQuickEntryRow>
      <div className="flex gap-3 mt-5">
        <Button onClick={onClose} className="flex-1 min-h-[50px]">
          {t('cancel')}
        </Button>
        <Button type="submit" variant="primary" disabled={submitting} className="flex-1 min-h-[50px] text-[15px]">
          {submitting ? t('saving') : t('add')}
        </Button>
      </div>
    </form>
  );
}

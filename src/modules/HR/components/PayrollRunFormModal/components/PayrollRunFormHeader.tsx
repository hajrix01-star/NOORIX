import React from 'react';
import { Input } from '../../../../../ui';

type Props = {
  payrollMonth: string;
  defaultMonth: string;
  setPayrollMonth: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  alreadyExists: boolean;
  t: (key: string, ...subst: string[]) => string;
};

export function PayrollRunFormHeader({
  payrollMonth,
  defaultMonth,
  setPayrollMonth,
  notes,
  setNotes,
  alreadyExists,
  t,
}: Props) {
  return (
    <div className="pt-1 pb-2 shrink-0">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[12px] font-semibold text-noorix-muted mb-1.5 block">{t('payrollMonth')}</label>
          <Input
            type="month"
            className="prfm-modal-field"
            value={payrollMonth ? payrollMonth.slice(0, 7) : ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPayrollMonth(e.target.value ? `${e.target.value}-01` : defaultMonth)
            }
          />
          {alreadyExists && (
            <span className="text-[12px] font-semibold mt-1.5 block text-noorix-amber">
              {t('payrollMonthExists') || 'مسيرة لهذا الشهر موجودة'}
            </span>
          )}
        </div>
        <div>
          <label className="text-[12px] font-semibold text-noorix-muted mb-1.5 block">{t('notes')}</label>
          <Input
            type="text"
            className="prfm-modal-field"
            value={notes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNotes(e.target.value)}
            placeholder={t('notes')}
          />
        </div>
      </div>
    </div>
  );
}

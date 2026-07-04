import React from 'react';
import { Button, DateField, Input, FmtNum } from '../../../ui';
import type { HrEosDraftState } from './hrPrintDocumentsTabDrafts';

type Translate = (key: string) => string;

export function HrPrintEosPanel({
  t,
  lang,
  eos,
  updateEos,
  addCustomRowEos,
  eosWageTotal,
}: {
  t: Translate;
  lang: string;
  eos: HrEosDraftState;
  updateEos: (patch: Partial<HrEosDraftState>) => void;
  addCustomRowEos: () => void;
  eosWageTotal: number;
}) {
  return (
    <div className="space-y-3 border-t border-noorix-border pt-4">
      <p className="m-0 text-[12px] font-semibold text-noorix-blue">{t('hrPrintEosSection')}</p>
      <p className="m-0 text-[11px] text-noorix-muted">{t('hrPrintEosLetterTitleHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input type="text" label={t('hrPrintCompanyName')} value={eos.companyName} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ companyName: e.target.value })} />
        <Input type="text" label={t('hrPrintCompanyNameEn')} value={eos.companyNameEn} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ companyNameEn: e.target.value })} />
        <Input type="text" label={t('hrPrintNameAr')} value={eos.nameAr} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ nameAr: e.target.value })} />
        <Input type="text" label={t('hrPrintNameEn')} value={eos.nameEn} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ nameEn: e.target.value })} />
        <Input type="text" label={t('employeeSerial')} value={eos.employeeSerial} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ employeeSerial: e.target.value })} />
        <Input type="text" label={t('jobTitle')} value={eos.jobTitle} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ jobTitle: e.target.value })} />
        <Input type="text" label={t('iqamaNumber')} value={eos.iqama} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ iqama: e.target.value })} />
        <DateField label={t('joinDate')} value={eos.joinDate} onValueChange={(value) => updateEos({ joinDate: value })} />
        <DateField
          label={lang === 'ar' ? 'تاريخ نهاية الخدمة' : 'End of service date'}
          value={eos.endDate}
          onValueChange={(value) => updateEos({ endDate: value })}
        />
      </div>
      <p className="m-0 text-[11px] text-noorix-muted">{t('hrPrintEosWageHint')}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input type="text" inputMode="decimal" label={t('basicSalary')} value={eos.basic} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ basic: e.target.value })} />
        <Input type="text" inputMode="decimal" label={t('housingAllowance')} value={eos.housing} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ housing: e.target.value })} />
        <Input type="text" inputMode="decimal" label={t('transportAllowance')} value={eos.transport} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ transport: e.target.value })} />
        <Input type="text" inputMode="decimal" label={t('otherAllowance')} value={eos.other} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ other: e.target.value })} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">{t('customAllowances')}</span>
          <Button type="button" size="sm" variant="ghost" onClick={addCustomRowEos}>
            {t('addCustomAllowance')}
          </Button>
        </div>
        {(eos.customRows || []).map((row, idx) => (
          <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-center">
            <Input
              type="text"
              value={row.label}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                const next = [...(eos.customRows || [])];
                next[idx] = { ...row, label: e.target.value };
                updateEos({ customRows: next });
              }}
            />
            <Input
              type="text"
              inputMode="decimal"
              value={row.amount}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                const next = [...(eos.customRows || [])];
                next[idx] = { ...row, amount: e.target.value };
                updateEos({ customRows: next });
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={() =>
                updateEos({
                  customRows: (eos.customRows || []).filter((_, i) => i !== idx),
                })
              }
            >
              {t('delete')}
            </Button>
          </div>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input type="text" inputMode="decimal" label={t('hrPrintEosAmount')} value={eos.eosAmount} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ eosAmount: e.target.value })} />
        <Input type="text" inputMode="decimal" label={t('hrPrintOtherDues')} value={eos.otherAccrued} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ otherAccrued: e.target.value })} />
        <Input type="text" inputMode="decimal" label={t('hrPrintDeductions')} value={eos.deductions} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ deductions: e.target.value })} />
        <Input type="text" inputMode="decimal" label={t('hrPrintNetPayable')} value={eos.netPayable} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ netPayable: e.target.value })} />
      </div>
      <Input multiline rows={4} label={t('hrPrintSettlementTextAr')} value={eos.settlementNotesAr} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ settlementNotesAr: e.target.value })} />
      <Input multiline rows={4} label={t('hrPrintSettlementTextEn')} value={eos.settlementNotesEn} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updateEos({ settlementNotesEn: e.target.value })} />
      <div className="text-[12px] text-noorix-muted">
        {t('hrPrintPackageTotal')}: <FmtNum n={eosWageTotal} /> SR
      </div>
    </div>
  );
}

import React from 'react';
import { Button, Checkbox, Input, FmtNum } from '../../../ui';
import { HR_MONTH_LABELS_AR } from './hrPrintDocumentsTabFormat';
import type { HrAnnualDraftState, HrPayrollDraftState } from './hrPrintDocumentsTabDrafts';

type Translate = (key: string) => string;

export function HrPrintPayrollPanel({
  t,
  lang,
  payroll,
  annual,
  updatePayroll,
  setAnnual,
  payrollTotal,
  annualSum,
  fillAnnualWithMonthlyTotal,
  addCustomRowPayroll,
}: {
  t: Translate;
  lang: string;
  payroll: HrPayrollDraftState;
  annual: HrAnnualDraftState;
  updatePayroll: (patch: Partial<HrPayrollDraftState>) => void;
  setAnnual: React.Dispatch<React.SetStateAction<HrAnnualDraftState>>;
  payrollTotal: number;
  annualSum: number;
  fillAnnualWithMonthlyTotal: () => void;
  addCustomRowPayroll: () => void;
}) {
  return (
    <div className="space-y-4 border-t border-noorix-border pt-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant={payroll.payrollFormat === 'single' ? 'primary' : 'ghost'} onClick={() => updatePayroll({ payrollFormat: 'single' })}>
          {t('hrPrintFormatSingle')}
        </Button>
        <Button type="button" size="sm" variant={payroll.payrollFormat === 'annual' ? 'primary' : 'ghost'} onClick={() => updatePayroll({ payrollFormat: 'annual' })}>
          {t('hrPrintFormatAnnual')}
        </Button>
        <Button type="button" size="sm" variant={payroll.payrollFormat === 'salaryLetter' ? 'primary' : 'ghost'} onClick={() => updatePayroll({ payrollFormat: 'salaryLetter' })}>
          {t('hrPrintFormatSalaryLetter')}
        </Button>
      </div>

      <p className="m-0 text-[12px] font-semibold text-noorix-blue">{t('hrPrintPayrollSection')}</p>
      <div className="space-y-3 rounded-lg border border-noorix-border/80 bg-noorix-bg-muted/15 p-3 sm:p-4">
        <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-noorix-muted">{t('hrPrintSectionDocParty')}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input type="text" label={t('hrPrintCompanyName')} value={payroll.companyName} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ companyName: e.target.value })} />
          <Input type="text" label={t('hrPrintCompanyNameEn')} value={payroll.companyNameEn} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ companyNameEn: e.target.value })} />
          <Input type="text" label={t('hrPrintNameAr')} value={payroll.nameAr} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ nameAr: e.target.value })} />
          <Input type="text" label={t('hrPrintNameEn')} value={payroll.nameEn} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ nameEn: e.target.value })} />
          <Input type="text" label={t('employeeSerial')} value={payroll.employeeSerial} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ employeeSerial: e.target.value })} />
          <Input type="text" label={t('jobTitle')} value={payroll.jobTitle} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ jobTitle: e.target.value })} />
          <Input type="text" label={t('iqamaNumber')} value={payroll.iqama} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ iqama: e.target.value })} />
          <Input type="date" label={t('joinDate')} value={payroll.joinDate} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ joinDate: e.target.value })} />
        </div>
      </div>

      {(payroll.payrollFormat === 'single' || payroll.payrollFormat === 'salaryLetter') && (
        <div className="space-y-3 rounded-lg border border-noorix-border/80 bg-noorix-bg-muted/15 p-3 sm:p-4">
          <p className="m-0 text-[11px] font-bold uppercase tracking-wide text-noorix-muted">{t('hrPrintSectionPayPackage')}</p>
          <Input type="text" label={t('hrPrintPeriodLabel')} value={payroll.periodLabel} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ periodLabel: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input type="text" inputMode="decimal" label={t('basicSalary')} value={payroll.basic} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ basic: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('housingAllowance')} value={payroll.housing} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ housing: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('transportAllowance')} value={payroll.transport} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ transport: e.target.value })} />
            <Input type="text" inputMode="decimal" label={t('otherAllowance')} value={payroll.other} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ other: e.target.value })} />
            <Input
              type="text"
              inputMode="decimal"
              label={lang === 'ar' ? 'أوفر تايم (تقدير شهري)' : 'Overtime (monthly est.)'}
              value={payroll.overtime}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ overtime: e.target.value })}
            />
          </div>
          <Checkbox
            checked={payroll.showBreakdown}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePayroll({ showBreakdown: e.target.checked })}
            label={t('hrPrintShowAllowanceDetail')}
            containerClassName="cursor-pointer items-center text-[13px] font-medium"
            className="h-4 w-4 accent-noorix-blue"
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-semibold">{t('customAllowances')}</span>
              <Button type="button" size="sm" variant="ghost" onClick={addCustomRowPayroll}>
                {t('addCustomAllowance')}
              </Button>
            </div>
            {(payroll.customRows || []).map((row, idx) => (
              <div key={row.key} className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-center">
                <Input
                  type="text"
                  label={t('customAllowanceName')}
                  value={row.label}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                    const next = [...(payroll.customRows || [])];
                    next[idx] = { ...row, label: e.target.value };
                    updatePayroll({ customRows: next });
                  }}
                />
                <Input
                  type="text"
                  inputMode="decimal"
                  label={t('customAllowanceAmount')}
                  value={row.amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                    const next = [...(payroll.customRows || [])];
                    next[idx] = { ...row, amount: e.target.value };
                    updatePayroll({ customRows: next });
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() =>
                    updatePayroll({
                      customRows: (payroll.customRows || []).filter((_, i) => i !== idx),
                    })
                  }
                >
                  {t('delete')}
                </Button>
              </div>
            ))}
          </div>
          <Input multiline rows={3} label={t('note')} value={payroll.notes} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ notes: e.target.value })} />
          <div className="flex items-center justify-between rounded-lg border border-noorix-border bg-noorix-bg-muted px-3 py-2">
            <span className="text-[13px] font-semibold">{t('totalSalary')}</span>
            <span className="nx-font-numbers text-[16px] font-bold">
              <FmtNum n={payrollTotal} /> <span className="nx-sar">SR</span>
            </span>
          </div>
          {payroll.payrollFormat === 'salaryLetter' && (
            <div className="space-y-3 rounded-lg border border-dashed border-noorix-blue/30 bg-noorix-bg-muted/20 p-3 sm:p-4">
              <p className="m-0 text-[12px] font-semibold text-noorix-text">{t('hrPrintFormatSalaryLetter')}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input type="date" label={t('hrPrintLetterStart')} value={payroll.letterStartDate} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ letterStartDate: e.target.value })} />
                <Input type="date" label={t('hrPrintLetterEnd')} value={payroll.letterEndDate} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ letterEndDate: e.target.value })} />
              </div>
              <Input multiline rows={4} label={t('hrPrintSalaryLetterDeclAr')} value={payroll.declarationSalariesAr} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ declarationSalariesAr: e.target.value })} />
              <Input multiline rows={4} label={t('hrPrintSalaryLetterDeclEn')} value={payroll.declarationSalariesEn} onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => updatePayroll({ declarationSalariesEn: e.target.value })} />
            </div>
          )}
        </div>
      )}

      {payroll.payrollFormat === 'annual' && (
        <div className="space-y-3 rounded-lg border border-noorix-border/80 bg-noorix-bg-muted/15 p-3 sm:p-4">
          <p className="m-0 text-[13px] font-semibold text-noorix-text">{t('hrPrintAnnualSection')}</p>
          <div className="flex flex-wrap items-end gap-3">
            <Input
              type="number"
              label={t('hrPrintYear')}
              min={2000}
              max={2100}
              step={1}
              value={annual.year}
              onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setAnnual((a) => ({ ...a, year: Number(e.target.value) || a.year }))}
              className="w-[120px]"
            />
            <Button type="button" size="sm" variant="ghost" onClick={fillAnnualWithMonthlyTotal}>
              {t('hrPrintFillAllMonths')}
            </Button>
          </div>
          <p className="m-0 text-[11px] leading-relaxed text-noorix-muted">{t('hrPrintAnnualHint')}</p>
          <div>
            <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-wide text-noorix-muted">{t('hrPrintAnnualMonthsOnly')}</p>
            <div className="grid grid-cols-3 gap-x-2 gap-y-2 sm:grid-cols-4 md:grid-cols-6">
              {HR_MONTH_LABELS_AR.map((label, i) => (
                <label key={i} className="flex cursor-pointer items-center gap-2 rounded-md border border-noorix-border/60 bg-white/80 px-2 py-1.5 text-[12px] shadow-sm">
                  <Checkbox
                    checked={annual.monthOn[i]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const checked = e.target.checked;
                      setAnnual((a) => {
                        const monthOn = [...a.monthOn];
                        monthOn[i] = checked;
                        const g = String(a.perMonthGross ?? '').trim();
                        const amounts = a.amounts.map((amt, j) => {
                          if (!monthOn[j]) return '';
                          return g !== '' ? g : amt;
                        });
                        return { ...a, monthOn, amounts };
                      });
                    }}
                    className="h-4 w-4 shrink-0 accent-noorix-blue"
                  />
                  <span className="min-w-0 truncate">{label}</span>
                </label>
              ))}
            </div>
          </div>
          <Input
            type="text"
            inputMode="decimal"
            label={t('hrPrintAnnualPerMonthGross')}
            value={annual.perMonthGross ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
              const v = e.target.value;
              setAnnual((a) => ({
                ...a,
                perMonthGross: v,
                amounts: a.monthOn.map((on) => (on ? v : '')),
              }));
            }}
          />
          <div className="flex items-center justify-between rounded-md border border-noorix-border bg-noorix-bg-muted/40 px-3 py-2 text-[14px] font-bold">
            <span>{t('hrPrintAnnualTotal')}</span>
            <span className="nx-font-numbers">
              <FmtNum n={annualSum} /> SR
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

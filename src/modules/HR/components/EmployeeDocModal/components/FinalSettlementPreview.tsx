import React from 'react';
import Decimal from 'decimal.js';
import { formatSaudiDate } from '../../../../../utils/saudiDate';
import { Checkbox, Input } from '../../../../../ui';
import { hrFmt } from '../../../utils/hrFmt';
import { parseWorkHours } from '../../../utils/employeeSalaryMath';
import type { DocSalaryRow } from '../types';
import type { EmployeeDocTFunction } from '../types';
import { EmployeeDocDocumentFrame } from './EmployeeDocDocumentFrame';
import { EmployeeDocEmployeeInfoTable } from './EmployeeDocEmployeeInfoTable';
import { EmployeeDocSalaryBreakdownTable } from './EmployeeDocSalaryBreakdownTable';
import { EOS_REASON_OPTIONS, type EosReason } from '../../../utils/hrCalculations/eos';

type EosBundle = {
  serviceDays: number;
  serviceYears: number;
  wageForEos: number;
  fullAward: number;
  factorPct: number;
  eosAmount: number;
  appliedEosAmount: number;
  finalTotal: number;
};

function getEosReasonLabel(reason: EosReason, t: EmployeeDocTFunction) {
  if (reason === 'employer') return t('eosCalcReasonEmployer');
  if (reason === 'article81') return t('eosCalcReasonArticle81');
  if (reason === 'resignation') return t('eosCalcReasonResignation');
  if (reason === 'force_majeure') return 'قوة قاهرة — ترك العمل لأسباب خارجة عن الإرادة';
  if (reason === 'maternity') return 'عاملة — استقالة خلال 6 أشهر من الزواج أو 3 من الوضع';
  return t('eosCalcReasonArticle80');
}

export function FinalSettlementPreview({
  employee,
  companyName,
  companyLogo,
  t,
  rows,
  lastMonthlyComp,
  includeEos,
  setIncludeEos,
  eosEndDate,
  setEosEndDate,
  eosReason,
  setEosReason,
  eosSalary,
  setEosSalary,
  eos,
  settlementDeclaration,
  overtimeHoursPerDay,
}: {
  employee: Record<string, unknown>;
  companyName?: string;
  companyLogo?: string;
  t: EmployeeDocTFunction;
  rows: DocSalaryRow[];
  lastMonthlyComp: number;
  includeEos: boolean;
  setIncludeEos: (v: boolean) => void;
  eosEndDate: string;
  setEosEndDate: (v: string) => void;
  eosReason: string;
  setEosReason: (v: string) => void;
  eosSalary: string;
  setEosSalary: (v: string) => void;
  eos: EosBundle;
  settlementDeclaration: { ar: string; en: string; clauseAr: string; clauseEn: string };
  overtimeHoursPerDay: number;
}) {
  return (
    <EmployeeDocDocumentFrame
      compact
      companyName={companyName}
      companyLogo={companyLogo}
      arabicTitle="مخالصة وتسوية نهائية"
      englishTitle="Final Settlement & Clearance"
    >
      <div className="hr-doc-panel-section">
        <Checkbox
          checked={includeEos}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncludeEos(e.target.checked)}
          label={includeEos ? t('includeEosInSettlement') : t('excludeEosInSettlement')}
        />
      </div>
      <div className="hr-doc-panel-section">
        <div className="font-bold mb-2">حاسبة نهاية الخدمة (تفصيل قبل الطباعة) / EOS Calculator (before print)</div>
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(160px,1fr))]">
          <div>
            <Input type="date" label="تاريخ نهاية الخدمة" value={eosEndDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEosEndDate(e.target.value)} />
          </div>
          <div>
            <Input type="select" label="سبب الانتهاء" value={eosReason} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEosReason(e.target.value)}>
              {EOS_REASON_OPTIONS.map((reason) => (
                <option key={reason} value={reason}>{getEosReasonLabel(reason, t)}</option>
              ))}
            </Input>
          </div>
          <div>
            <Input
              type="number"
              label="الأجر المعتمد لنهاية الخدمة"
              min="0"
              step="0.01"
              value={eosSalary}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEosSalary(e.target.value)}
              onBlur={() => setEosSalary(new Decimal(eosSalary || 0).toDecimalPlaces(2).toString())}
            />
          </div>
        </div>
      </div>
      <div className="hr-doc-section-compact">
        <EmployeeDocEmployeeInfoTable employee={employee} />
      </div>
      <div className="hr-doc-section-compact">
        <EmployeeDocSalaryBreakdownTable rows={rows} total={lastMonthlyComp} />
      </div>
      <div className="hr-doc-section-compact">
        <div className="bilingual">
          <div className="hr-doc-box text-left" dir="ltr">
            <h3 className="hr-doc-h3">Final Entitlements Calculation</h3>
            <div className="hr-doc-calc-grid">
              {includeEos ? (
                <>
                  <span>Service period (days)</span>
                  <span className="hr-doc-num">{eos.serviceDays}</span>
                  <span>Service period (years)</span>
                  <span className="hr-doc-num">{hrFmt(eos.serviceYears)}</span>
                  <span>Work hours/day</span>
                  <span className="hr-doc-num">{hrFmt(parseWorkHours(employee?.workHours))}</span>
                  <span>Overtime hours/day</span>
                  <span className="hr-doc-num">{hrFmt(overtimeHoursPerDay)}</span>
                  <span>Wage used for EOS</span>
                  <span className="hr-doc-num">{hrFmt(eos.wageForEos)}</span>
                  <span>Full EOS award</span>
                  <span className="hr-doc-num">{hrFmt(eos.fullAward)}</span>
                  <span>Eligibility factor</span>
                  <span className="hr-doc-num">{hrFmt(eos.factorPct)}%</span>
                  <span>EOS amount by law</span>
                  <span className="hr-doc-num">{hrFmt(eos.eosAmount)}</span>
                  <span>Amount in settlement</span>
                  <span className="hr-doc-num">{hrFmt(eos.appliedEosAmount)}</span>
                </>
              ) : null}
              <span className="font-extrabold">{includeEos ? t('finalSettlementTotalWithEos') : t('finalSettlementTotalSalaryOnly')}</span>
              <span className="font-extrabold hr-doc-num">{hrFmt(eos.finalTotal)}</span>
            </div>
          </div>
          <div className="hr-bilingual-sep" aria-hidden />
          <div className="hr-doc-box text-right" dir="rtl">
            <h3 className="hr-doc-h3">حسبة المستحقات النهائية</h3>
            <div className="hr-doc-calc-grid">
              {includeEos ? (
                <>
                  <span>مدة الخدمة (يوم)</span>
                  <span className="hr-doc-num-rtl">{eos.serviceDays}</span>
                  <span>مدة الخدمة (سنة)</span>
                  <span className="hr-doc-num-rtl">{hrFmt(eos.serviceYears)}</span>
                  <span>ساعات العمل اليومية</span>
                  <span className="hr-doc-num-rtl">{hrFmt(parseWorkHours(employee?.workHours))}</span>
                  <span>ساعات الأوفرتايم اليومية</span>
                  <span className="hr-doc-num-rtl">{hrFmt(overtimeHoursPerDay)}</span>
                  <span>الأجر المعتمد للحسبة</span>
                  <span className="hr-doc-num-rtl">{hrFmt(eos.wageForEos)}</span>
                  <span>مكافأة نهاية الخدمة الكاملة</span>
                  <span className="hr-doc-num-rtl">{hrFmt(eos.fullAward)}</span>
                  <span>نسبة الاستحقاق</span>
                  <span className="hr-doc-num-rtl">{hrFmt(eos.factorPct)}%</span>
                  <span>قيمة نهاية الخدمة حسب النظام</span>
                  <span className="hr-doc-num-rtl">{hrFmt(eos.eosAmount)}</span>
                  <span>القيمة المضافة في المخالصة</span>
                  <span className="hr-doc-num-rtl">{hrFmt(eos.appliedEosAmount)}</span>
                </>
              ) : null}
              <span className="font-extrabold">{includeEos ? t('finalSettlementTotalWithEos') : t('finalSettlementTotalSalaryOnly')}</span>
              <span className="font-extrabold hr-doc-num-rtl">{hrFmt(eos.finalTotal)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="hr-doc-section-compact">
        <div className="bilingual">
          <div className="hr-doc-box text-left" dir="ltr">
            <h3 className="hr-doc-h3">Employee Declaration</h3>
            <p className="hr-doc-copy">
              I, <strong>{String(employee?.nameEn || employee?.name || employee?.nameAr || '—')}</strong>, acknowledge receipt of my final dues as per the approved settlement,
              and confirm that all company property and records in my possession have been returned unless otherwise recorded by the company.
            </p>
            <p className="hr-doc-copy-follow">
              <strong>Termination:</strong> {settlementDeclaration.en}
              <br />
              <strong>{settlementDeclaration.clauseEn}</strong>
            </p>
          </div>
          <div className="hr-bilingual-sep" aria-hidden />
          <div className="hr-doc-box text-right" dir="rtl">
            <h3 className="hr-doc-h3">إقرار الموظف</h3>
            <p className="hr-doc-copy">
              أقر أنا <strong>{String(employee?.name || employee?.nameAr || '—')}</strong> بأنني استلمت مستحقاتي النهائية وفق التسوية المعتمدة،
              وأنني قمت بتسليم ما بعهدتي من ممتلكات أو مستندات تخص الشركة، ما لم يثبت خلاف ذلك في سجل العهد أو المخالصة الداخلية.
            </p>
            <p className="hr-doc-copy-follow">
              <strong>بيان إنهاء الخدمة:</strong> {settlementDeclaration.ar}
              <br />
              <strong>{settlementDeclaration.clauseAr}</strong>
            </p>
          </div>
        </div>
      </div>
      <div className="hr-doc-footer-compact">
        <div className="hr-doc-date-sm">تاريخ الإصدار / Issue Date: {formatSaudiDate(new Date())}</div>
        <div className="grid gap-3 mt-3 [grid-template-columns:1fr_1fr_1fr]" dir="ltr">
          <div className="hr-doc-signature-sm">
            HR / الموارد البشرية
          </div>
          <div className="hr-doc-signature-sm">
            Employee / الموظف
          </div>
          <div className="hr-doc-signature-sm">
            Company Approval / اعتماد الشركة
          </div>
        </div>
      </div>
    </EmployeeDocDocumentFrame>
  );
}

import React from 'react';
import Decimal from 'decimal.js';
import { formatSaudiDate } from '../../../../../utils/saudiDate';
import { Input } from '../../../../../ui';
import { hrFmt } from '../../../utils/hrFmt';
import { parseWorkHours } from '../../../utils/employeeSalaryMath';
import type { DocSalaryRow } from '../types';
import type { EmployeeDocTFunction } from '../types';
import { DOC_GRID, DOC_SEP, DOC_BOX, DOC_H3, SETTLE_SECTION } from '../constants';
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
      <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--noorix-border)', background: '#f8fafc' }}>
        <label className="nx-checkbox">
          <input type="checkbox" checked={includeEos} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIncludeEos(e.target.checked)} />
          {includeEos ? t('includeEosInSettlement') : t('excludeEosInSettlement')}
        </label>
      </div>
      <div style={{ padding: '12px 22px', borderBottom: '1px solid var(--noorix-border)', background: '#f8fafc' }}>
        <div className="font-bold mb-2">حاسبة نهاية الخدمة (تفصيل قبل الطباعة) / EOS Calculator (before print)</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
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
      <div style={SETTLE_SECTION}>
        <EmployeeDocEmployeeInfoTable employee={employee} />
      </div>
      <div style={SETTLE_SECTION}>
        <EmployeeDocSalaryBreakdownTable rows={rows} total={lastMonthlyComp} />
      </div>
      <div style={SETTLE_SECTION}>
        <div className="bilingual" style={DOC_GRID}>
          <div style={{ ...DOC_BOX, direction: 'ltr', textAlign: 'left' }}>
            <h3 style={DOC_H3}>Final Entitlements Calculation</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '2px 10px', fontSize: 10.5, lineHeight: 1.3 }}>
              {includeEos ? (
                <>
                  <span>Service period (days)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{eos.serviceDays}</span>
                  <span>Service period (years)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.serviceYears)}</span>
                  <span>Work hours/day</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(parseWorkHours(employee?.workHours))}</span>
                  <span>Overtime hours/day</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(overtimeHoursPerDay)}</span>
                  <span>Wage used for EOS</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.wageForEos)}</span>
                  <span>Full EOS award</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.fullAward)}</span>
                  <span>Eligibility factor</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.factorPct)}%</span>
                  <span>EOS amount by law</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.eosAmount)}</span>
                  <span>Amount in settlement</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.appliedEosAmount)}</span>
                </>
              ) : null}
              <span style={{ fontWeight: 800 }}>{includeEos ? t('finalSettlementTotalWithEos') : t('finalSettlementTotalSalaryOnly')}</span>
              <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{hrFmt(eos.finalTotal)}</span>
            </div>
          </div>
          <div className="hr-bilingual-sep" style={DOC_SEP} aria-hidden />
          <div style={{ ...DOC_BOX, direction: 'rtl', textAlign: 'right' }}>
            <h3 style={DOC_H3}>حسبة المستحقات النهائية</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '2px 10px', fontSize: 10.5, lineHeight: 1.3 }}>
              {includeEos ? (
                <>
                  <span>مدة الخدمة (يوم)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{eos.serviceDays}</span>
                  <span>مدة الخدمة (سنة)</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.serviceYears)}</span>
                  <span>ساعات العمل اليومية</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(parseWorkHours(employee?.workHours))}</span>
                  <span>ساعات الأوفرتايم اليومية</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(overtimeHoursPerDay)}</span>
                  <span>الأجر المعتمد للحسبة</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.wageForEos)}</span>
                  <span>مكافأة نهاية الخدمة الكاملة</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.fullAward)}</span>
                  <span>نسبة الاستحقاق</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.factorPct)}%</span>
                  <span>قيمة نهاية الخدمة حسب النظام</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.eosAmount)}</span>
                  <span>القيمة المضافة في المخالصة</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.appliedEosAmount)}</span>
                </>
              ) : null}
              <span style={{ fontWeight: 800 }}>{includeEos ? t('finalSettlementTotalWithEos') : t('finalSettlementTotalSalaryOnly')}</span>
              <span style={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', direction: 'ltr', unicodeBidi: 'embed' }}>{hrFmt(eos.finalTotal)}</span>
            </div>
          </div>
        </div>
      </div>
      <div style={SETTLE_SECTION}>
        <div className="bilingual" style={DOC_GRID}>
          <div style={{ ...DOC_BOX, direction: 'ltr', textAlign: 'left' }}>
            <h3 style={DOC_H3}>Employee Declaration</h3>
            <p style={{ lineHeight: 1.45, margin: 0, fontSize: 10.5 }}>
              I, <strong>{String(employee?.nameEn || employee?.name || employee?.nameAr || '—')}</strong>, acknowledge receipt of my final dues as per the approved settlement,
              and confirm that all company property and records in my possession have been returned unless otherwise recorded by the company.
            </p>
            <p style={{ lineHeight: 1.45, marginTop: 8, fontSize: 10.5 }}>
              <strong>Termination:</strong> {settlementDeclaration.en}
              <br />
              <strong>{settlementDeclaration.clauseEn}</strong>
            </p>
          </div>
          <div className="hr-bilingual-sep" style={DOC_SEP} aria-hidden />
          <div style={{ ...DOC_BOX, direction: 'rtl', textAlign: 'right' }}>
            <h3 style={DOC_H3}>إقرار الموظف</h3>
            <p style={{ lineHeight: 1.45, margin: 0, fontSize: 10.5 }}>
              أقر أنا <strong>{String(employee?.name || employee?.nameAr || '—')}</strong> بأنني استلمت مستحقاتي النهائية وفق التسوية المعتمدة،
              وأنني قمت بتسليم ما بعهدتي من ممتلكات أو مستندات تخص الشركة، ما لم يثبت خلاف ذلك في سجل العهد أو المخالصة الداخلية.
            </p>
            <p style={{ lineHeight: 1.45, marginTop: 8, fontSize: 10.5 }}>
              <strong>بيان إنهاء الخدمة:</strong> {settlementDeclaration.ar}
              <br />
              <strong>{settlementDeclaration.clauseAr}</strong>
            </p>
          </div>
        </div>
      </div>
      <div style={{ padding: '10px 14px' }}>
        <div style={{ color: '#64748b', fontSize: 10, textAlign: 'center' }}>تاريخ الإصدار / Issue Date: {formatSaudiDate(new Date())}</div>
        <div className="grid gap-3 mt-3" style={{ gridTemplateColumns: '1fr 1fr 1fr', direction: 'ltr' }}>
          <div className="text-center" style={{ paddingTop: 20, borderTop: '1px solid #cbd5e1', fontSize: 10 }}>
            HR / الموارد البشرية
          </div>
          <div className="text-center" style={{ paddingTop: 20, borderTop: '1px solid #cbd5e1', fontSize: 10 }}>
            Employee / الموظف
          </div>
          <div className="text-center" style={{ paddingTop: 20, borderTop: '1px solid #cbd5e1', fontSize: 10 }}>
            Company Approval / اعتماد الشركة
          </div>
        </div>
      </div>
    </EmployeeDocDocumentFrame>
  );
}

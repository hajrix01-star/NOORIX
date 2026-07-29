import React from 'react';
import type Decimal from 'decimal.js';
import { FmtNum } from '../../../ui';
import { hrFmt } from '../utils/hrFmt';
import {
  SAUDI_STANDARD_HOURS,
  SAUDI_WORK_DAYS_STANDARD,
  SAUDI_STANDARD_MONTHLY_HOURS,
} from '../utils/employeeSalaryMath';

type SalaryCalcTranslate = (key: string) => string;

type SalaryCalcResultRowProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  highlight?: boolean;
  muted?: boolean;
  divider?: boolean;
};

function ResultRow({ label, value, highlight = false, muted = false, divider = false }: SalaryCalcResultRowProps) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-3 py-2',
        divider ? 'border-t border-noorix-border mt-1 pt-3' : 'border-b border-noorix-border/50 last:border-b-0',
        highlight ? 'font-bold' : '',
      ].join(' ')}
    >
      <span className={`text-[12px] ${muted ? 'text-noorix-muted' : 'text-noorix-text'}`}>{label}</span>
      <span className={`text-[13px] font-semibold ltr tabular-nums ${muted ? 'text-noorix-muted' : ''}`}>{value}</span>
    </div>
  );
}

function SectionTitle({ children, icon }: { children?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon && <span className="text-[14px]">{icon}</span>}
      <h4 className="text-[13px] font-bold text-noorix-text m-0">{children}</h4>
    </div>
  );
}

type SalaryCalcResultsPanelProps = {
  t: SalaryCalcTranslate;
  vacDays: number;
  workDays: number;
  restDays: number;
  overtimeHoursPerDay: number;
  totalActualHours: number;
  totalDailyOT: number;
  totalRestOT: number;
  totalOT: number;
  basic: Decimal;
  totalAllowances: Decimal;
  deduction: Decimal;
  actualHourlyRate: Decimal;
  basicHourlyRate: Decimal;
  overtimeHourlyRate: Decimal;
  dailyOTValue: Decimal;
  restOTValue: Decimal;
  totalOTValue: Decimal;
  calculatedTotal: Decimal;
  netSalary: Decimal;
  hasOT: boolean;
};

export function SalaryCalcResultsPanel({
  t,
  vacDays,
  workDays,
  restDays,
  overtimeHoursPerDay,
  totalActualHours,
  totalDailyOT,
  totalRestOT,
  totalOT,
  basic,
  totalAllowances,
  deduction,
  actualHourlyRate,
  basicHourlyRate,
  overtimeHourlyRate,
  dailyOTValue,
  restOTValue,
  totalOTValue,
  calculatedTotal,
  netSalary,
  hasOT,
}: SalaryCalcResultsPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="noorix-surface-card p-4">
        <SectionTitle>تفصيل الراتب</SectionTitle>
        <ResultRow label="الراتب الأساسي" value={<span className="text-noorix-blue">{hrFmt(basic.toNumber())} <span className="nx-sar">SR</span></span>} />
        <ResultRow label="البدلات" value={`${hrFmt(totalAllowances.toNumber())} SR`} />
        {hasOT && (
          <ResultRow label="الأوفر تايم" value={<span className="text-noorix-green">{hrFmt(totalOTValue.toNumber())} <span className="nx-sar">SR</span></span>} />
        )}
        <ResultRow label="الإجمالي" value={<strong><FmtNum n={calculatedTotal.toNumber()} /> <span className="nx-sar">SR</span></strong>} highlight />
        {deduction.gt(0) && (
          <ResultRow label={`خصم الإجازة (${vacDays} يوم)`} value={<span className="text-noorix-red">-{hrFmt(deduction.toNumber())} SR</span>} />
        )}
        {deduction.gt(0) && (
          <ResultRow label="صافي الراتب" value={<strong><FmtNum n={netSalary.toNumber()} /> <span className="nx-sar">SR</span></strong>} highlight divider />
        )}
      </div>

      <div className="bg-noorix-bg-muted rounded-xl p-4">
        <SectionTitle>أجر الساعة (م107)</SectionTitle>
        <ResultRow
          label={<span>أجر الساعة الفعلي <span className="text-noorix-muted text-[11px]">(أساسي+بدلات) / 208</span></span>}
          value={`${hrFmt(actualHourlyRate.toNumber())} SR`}
          muted
        />
        <ResultRow
          label={<span>أجر الساعة الأساسي <span className="text-noorix-muted text-[11px]">أساسي / 208</span></span>}
          value={`${hrFmt(basicHourlyRate.toNumber())} SR`}
          muted
        />
        <ResultRow
          label={<span>أجر ساعة الأوفر تايم <span className="text-noorix-amber text-[11px]">فعلي + 50% أساسي</span></span>}
          value={<span className="text-noorix-amber font-bold">{hrFmt(overtimeHourlyRate.toNumber())} SR</span>}
        />
      </div>

      {hasOT && (
        <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-4">
          <SectionTitle>تفصيل الساعات</SectionTitle>
          <ResultRow label="إجمالي ساعات العمل الفعلية" value={`${totalActualHours} ساعة`} muted />
          <ResultRow
            label={`ساعات العمل المعيارية (${SAUDI_WORK_DAYS_STANDARD}x${SAUDI_STANDARD_HOURS})`}
            value={`${SAUDI_STANDARD_MONTHLY_HOURS} ساعة`}
            muted
          />
          {overtimeHoursPerDay > 0 && (
            <ResultRow label="ساعات إضافية يومية (ما فوق 8 ساعات)" value={<span className="text-noorix-amber">{totalDailyOT} ساعة</span>} />
          )}
          {restDays > 0 && (
            <>
              <ResultRow label="أيام العمل بدون راحة أسبوعية" value={<span className="text-noorix-amber">{restDays} يوم</span>} />
              <ResultRow label="ساعات العمل في أيام الراحة" value={<span className="text-noorix-amber">{totalRestOT} ساعة</span>} />
            </>
          )}
          <ResultRow label="إجمالي ساعات الأوفر تايم" value={<strong className="text-noorix-amber">{totalOT} ساعة</strong>} highlight divider />
        </div>
      )}

      {hasOT && (
        <div className="bg-green-50/70 border border-green-200/60 rounded-xl p-4">
          <SectionTitle>قيمة الأوفر تايم المستحق</SectionTitle>
          {totalDailyOT > 0 && (
            <ResultRow label="أوفر تايم الساعات الإضافية اليومية" value={`${hrFmt(dailyOTValue.toNumber())} SR`} muted />
          )}
          {restDays > 0 && (
            <ResultRow label="أوفر تايم أيام الراحة" value={`${hrFmt(restOTValue.toNumber())} SR`} muted />
          )}
          <ResultRow
            label="إجمالي الأوفر تايم المستحق"
            value={<strong className="text-noorix-green"><FmtNum n={totalOTValue.toNumber()} /> <span className="nx-sar">SR</span></strong>}
            highlight
            divider
          />
        </div>
      )}

      {hasOT && (
        <div className="flex items-start gap-2 p-3 bg-noorix-amber/10 border border-noorix-amber/25 rounded-xl">
          <p className="text-[12px] text-noorix-amber leading-relaxed m-0">
            هذا الحساب يفترض أن صاحب العمل يدفع الأوفر تايم بنسبة <strong>150%</strong> حسب النظام. إذا كان يدفع بنسبة أقل، فالراتب الأساسي الفعلي سيكون أعلى.
          </p>
        </div>
      )}
    </div>
  );
}

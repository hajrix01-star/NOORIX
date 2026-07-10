/**
 * SalaryCalcTab — حاسبة الرواتب (عكسية + ديناميكية)
 *
 * مراجع قانونية (بوابة وزارة الموارد البشرية الرسمية):
 * - المادة 98: ساعات العمل المعيارية 8 ساعات يومياً.
 * - المادة 107: "يُدفع للعامل أجر ساعة مضافاً إليه 50% من أجره الأساسي"
 *   أجر_ساعة_OT = (أجر_فعلي + 0.5 × أساسي) ÷ 208
 *   حيث أجر_فعلي = أساسي + بدلات
 *   أيام > 26 تُعدّ «أيام راحة» — كامل ساعاتها أوفر تايم.
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTranslation } from '../../../i18n/useTranslation';
import { useEmployees } from '../../../hooks/useEmployees';
import { useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from '../../../hooks/useApiQuery';
import { getEmployeeCompensationSnapshots, updateEmployee } from '../../../services/api';
import { hrFmt } from '../utils/hrFmt';
import { useApiMutation } from '../../../hooks/useApiMutation';
import {
  SAUDI_STANDARD_HOURS,
  SAUDI_WORK_DAYS_STANDARD,
  SAUDI_STANDARD_MONTHLY_HOURS,
  DEFAULT_OVERTIME_WORK_DAYS,
  parseWorkHours,
  parseOvertimeWorkDaysPerMonth,
  mergeOvertimeWorkDaysIntoSchedule,
  computeSalaryCalculator,
} from '../utils/employeeSalaryMath';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Input, FormRow, FmtNum, usePrintPreview } from '../../../ui';
import { employeeKeys, hrKeys } from '../../../services/queryKeys';
import { HR_TOOLS_ROOT_CLASS } from '../hrWorkspaceLayout';
import { buildSalaryCalcPrintHtml } from './salaryCalcPrint';

type HrAny = ReturnType<typeof JSON.parse>;

/** صف نتيجة موحّد */
function ResultRow({ label, value, highlight = false, muted = false, divider = false }: HrAny) {
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

/** عنوان قسم داخل البطاقة */
function SectionTitle({ children, icon }: { children?: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon && <span className="text-[14px]">{icon}</span>}
      <h4 className="text-[13px] font-bold text-noorix-text m-0">{children}</h4>
    </div>
  );
}

export default function SalaryCalcTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies } = useApp();
  const companyId = activeCompanyId ?? '';
  const company   = companies?.find((c: HrAny) => c.id === companyId);
  const companyName = company?.nameAr || company?.name || 'الشركة';
  const companyLogoUrl = String(company?.logoUrl || '').trim();
  const { openPrintPreview, printPreviewModal } = usePrintPreview({
    title: t('hrTabSalaryCalc'),
    closeLabel: t('close') || 'Close',
    printLabel: `${t('print')} / PDF`,
  });
  const queryClient = useQueryClient();
  const { employees } = useEmployees(companyId);

  const [targetTotal,      setTargetTotal]      = useState('');
  const [hoursPerDay,      setHoursPerDay]      = useState(String(SAUDI_STANDARD_HOURS));
  const [daysPerMonth,     setDaysPerMonth]     = useState(String(DEFAULT_OVERTIME_WORK_DAYS));
  const [vacationDays,     setVacationDays]     = useState('0');
  const [housingAllowance, setHousingAllowance] = useState('0');
  const [transportAllowance, setTransportAllowance] = useState('0');
  const [otherAllowance,   setOtherAllowance]   = useState('0');
  const [selectedEmployee, setSelectedEmployee] = useState('');

  const emp = employees.find((e: HrAny) => e.id === selectedEmployee);
  const employeeIds = useMemo(() => employees.map((row: HrAny) => row.id).filter(Boolean), [employees]);
  const {
    data: compensationSnapshots,
    isLoading: compensationSnapshotsLoading,
    error: compensationSnapshotsError,
  } = useApiQuery<HrAny>({
    queryKey: hrKeys.compensationSnapshots(companyId, employeeIds),
    queryFn: () => getEmployeeCompensationSnapshots(companyId, employeeIds),
    enabled: !!companyId && employeeIds.length > 0,
    fallbackMessage: t('loadingError'),
  });

  const snapshotByEmployeeId = useMemo(() => {
    const map = new Map();
    for (const snapshot of compensationSnapshots?.items ?? []) {
      if (snapshot?.employeeId) map.set(snapshot.employeeId, snapshot);
    }
    return map;
  }, [compensationSnapshots]);
  const selectedSnapshot = emp ? snapshotByEmployeeId.get(emp.id) : null;
  const selectedSalaryPackage = selectedSnapshot?.salaryPackage;
  const selectedCustomAllowanceTotal = Number(selectedSalaryPackage?.customAllowanceTotal);
  const hasSelectedCentralSalary =
    !emp ||
    (
      !!selectedSalaryPackage &&
      Number.isFinite(Number(selectedSalaryPackage.total)) &&
      Number.isFinite(selectedCustomAllowanceTotal)
    );

  useEffect(() => {
    if (!selectedEmployee) return;
    const e = employees.find((x: HrAny) => x.id === selectedEmployee);
    const snapshot = e ? snapshotByEmployeeId.get(e.id) : null;
    if (!e) return;
    if (!snapshot?.salaryPackage) {
      if (!compensationSnapshotsLoading) setTargetTotal('');
      return;
    }
    const dailyHours = parseWorkHours(e.workHours);
    const wd         = parseOvertimeWorkDaysPerMonth(e);
    setHoursPerDay(String(dailyHours));
    setDaysPerMonth(String(wd));
    setHousingAllowance(String(snapshot.salaryPackage.housingAllowance));
    setTransportAllowance(String(snapshot.salaryPackage.transportAllowance));
    setOtherAllowance(String(snapshot.salaryPackage.otherAllowance));
    setTargetTotal(String(snapshot.salaryPackage.total));
  }, [selectedEmployee, employees, snapshotByEmployeeId, compensationSnapshotsLoading]);

  // ── حسابات ──────────────────────────────────────────────
  const salaryCalc = computeSalaryCalculator({
    targetTotal,
    hoursPerDay,
    daysPerMonth,
    vacationDays,
    housingAllowance,
    transportAllowance,
    otherAllowance,
    customAllowanceTotal: emp && hasSelectedCentralSalary ? selectedCustomAllowanceTotal : 0,
    workSchedule: emp?.workSchedule || '',
  });

  const {
    hours,
    workDays,
    vacDays,
    regularWorkDays,
    restDays,
    overtimeHoursPerDay,
    totalActualHours,
    totalDailyOT,
    totalRestOT,
    totalOT,
    totalTarget,
    housing,
    transport,
    other,
    totalAllowances,
    basic,
    inverseWarning,
    deduction,
    actualHourlyRate,
    basicHourlyRate,
    overtimeHourlyRate,
    dailyOTValue,
    restOTValue,
    totalOTValue,
    calculatedTotal,
    netSalary,
    hasResult,
    hasOT,
  } = salaryCalc;

  // ── تحديث الموظف ─────────────────────────────────────────
  const updateMutation = useApiMutation({
    mutationFn: async ({ id, body }: HrAny) => updateEmployee(id, body, companyId),
    invalidateQueries: [employeeKeys.root()],
    successToast: () => t('salaryCalcUpdated') || 'تم تحديث الراتب بنجاح',
    errorToast: (e: HrAny) => e?.message || t('saveFailed'),
    onSuccess: (data: HrAny, variables: HrAny) => {
      queryClient.invalidateQueries({ queryKey: employeeKeys.detail(variables.id, companyId) });
      queryClient.invalidateQueries({ queryKey: employeeKeys.pagedByCompany(companyId) });
      queryClient.invalidateQueries({ queryKey: hrKeys.compensationSnapshot(companyId, variables.id) });
      queryClient.invalidateQueries({ queryKey: hrKeys.compensationSnapshotRoot() });
    },
  });

  function handleUpdateSalary() {
    if (!emp || !companyId || totalTarget.lte(0) || inverseWarning || !hasSelectedCentralSalary) return;
    updateMutation.mutate({
      id: emp.id,
      body: {
        basicSalary:        basic.toDecimalPlaces(2).toNumber(),
        housingAllowance:   housing.toDecimalPlaces(2).toNumber(),
        transportAllowance: transport.toDecimalPlaces(2).toNumber(),
        otherAllowance:     other.toDecimalPlaces(2).toNumber(),
        workHours:          String(Math.round(hours * 10) / 10),
        workSchedule:       mergeOvertimeWorkDaysIntoSchedule(emp.workSchedule || '', workDays),
      },
    });
  }

  const employeeAllowanceRows = useMemo(() => {
    if (!emp) return [];
    const rows = [];
    if (housing.gt(0))   rows.push({ label: t('housingAllowance'),   amount: housing.toNumber() });
    if (transport.gt(0)) rows.push({ label: t('transportAllowance'), amount: transport.toNumber() });
    if (other.gt(0))     rows.push({ label: t('otherAllowance'),     amount: other.toNumber() });
    const customRows = (selectedSnapshot?.customAllowances?.items ?? [])
      .filter((row: HrAny) => Number(row.amount) > 0)
      .map((row: HrAny) => ({ label: row.nameAr || row.nameEn || t('customAllowanceName'), amount: Number(row.amount) || 0 }));
    return [...rows, ...customRows];
  }, [emp, housing, transport, other, selectedSnapshot, t]);

  // ── طباعة ────────────────────────────────────────────────
  function handlePrint() {
    const html = buildSalaryCalcPrintHtml({
      companyName,
      companyLogoUrl,
      employee: emp,
      allowanceRows: employeeAllowanceRows,
      hours,
      workDays,
      regularWorkDays,
      restDays,
      overtimeHoursPerDay,
      totalDailyOT,
      totalRestOT,
      totalOT,
      vacDays,
      hasOT,
      totalTarget,
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
    });
    openPrintPreview({ title: t('hrTabSalaryCalc'), html });
  }

  // ── JSX ──────────────────────────────────────────────────
  return (
    <div className={HR_TOOLS_ROOT_CLASS}>
      {printPreviewModal}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start w-full min-w-0">

        {/* ── عمود الإدخال ── */}
        <div className="noorix-surface-card p-5 flex flex-col gap-4">
          <h3 className="text-[17px] font-bold text-noorix-text m-0">{t('hrTabSalaryCalc')}</h3>

          {/* اختيار الموظف */}
          <Input type="select" label={t('selectEmployee')} value={selectedEmployee} onChange={(e: HrAny) => setSelectedEmployee(e.target.value)}>
            <option value="">— {t('salaryCalcSelectOrEnter') || 'اختر أو أدخل يدوياً'} —</option>
            {(!compensationSnapshotsLoading && !compensationSnapshotsError
              ? employees.filter((e: HrAny) => snapshotByEmployeeId.has(e.id))
              : []
            ).map((e: HrAny) => {
              const snapshot = snapshotByEmployeeId.get(e.id);
              const total = snapshot?.salaryPackage?.total;
              const est = { toNumber: () => (Number.isFinite(Number(total)) ? Number(total) : 0) };
              return (
                <option key={e.id} value={e.id}>
                  {employeeDisplayName(e, lang, e.id)} — {hrFmt(est.toNumber())} SR
                  {e.workHours ? ` (${parseWorkHours(e.workHours)}h)` : ''}
                </option>
              );
            })}
          </Input>
          {compensationSnapshotsLoading && (
            <div className="text-[11px] text-noorix-muted">{t('loading')}</div>
          )}
          {compensationSnapshotsError && (
            <div className="text-[11px] text-noorix-red">
              {compensationSnapshotsError instanceof Error ? compensationSnapshotsError.message : t('loadingError')}
            </div>
          )}
          {emp && !compensationSnapshotsLoading && !hasSelectedCentralSalary && (
            <div className="text-[11px] text-noorix-red">
              {t('loadingError')}
            </div>
          )}

          {/* الإجمالي المستهدف */}
          <Input
            type="number"
            label={t('salaryCalcGross')}
            min="0"
            step="0.01"
            value={targetTotal}
            onChange={(e: HrAny) => setTargetTotal(e.target.value)}
          />

          {/* ساعات/يوم + أيام/شهر */}
          <FormRow>
            <Input
              type="number"
              label={t('salaryCalcHoursPerDay')}
              min="1" max="12" step="0.5"
              value={hoursPerDay}
              onChange={(e: HrAny) => setHoursPerDay(e.target.value)}
            />
            <div>
              <Input
                type="number"
                label={t('salaryCalcDaysPerMonth')}
                min="1" max="31"
                value={daysPerMonth}
                onChange={(e: HrAny) => setDaysPerMonth(e.target.value)}
              />
              <div className="text-[11px] text-noorix-muted mt-1.5 leading-[1.45]">
                أيام العمل الفعلية شهرياً (26 عادية + أيام الراحة إن وُجدت)
              </div>
            </div>
          </FormRow>

          {/* البدلات */}
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
            <Input type="number" step="0.01" min="0" label={t('housingAllowance')}   value={housingAllowance}   onChange={(e: HrAny) => setHousingAllowance(e.target.value)} />
            <Input type="number" step="0.01" min="0" label={t('transportAllowance')} value={transportAllowance} onChange={(e: HrAny) => setTransportAllowance(e.target.value)} />
            <Input type="number" step="0.01" min="0" label={t('otherAllowance')}     value={otherAllowance}     onChange={(e: HrAny) => setOtherAllowance(e.target.value)} />
          </div>

          {/* أيام الإجازة + ساعات OT (للعرض) */}
          <FormRow>
            <Input type="number" min="0" label={t('salaryCalcVacationDays')} value={vacationDays} onChange={(e: HrAny) => setVacationDays(e.target.value)} />
            <Input type="number" label="ساعات الأوفر تايم اليومية" value={overtimeHoursPerDay} readOnly className="bg-noorix-bg-muted" />
          </FormRow>

          {/* تحذير */}
          {inverseWarning && (
            <div className="text-[12px] text-noorix-amber bg-noorix-amber/10 border border-noorix-amber/30 rounded-lg px-3 py-2">
              الإجمالي المستهدف أقل من مجموع البدلات مع ساعات الأوفر تايم المحددة. خفّف البدلات أو زد الإجمالي.
            </div>
          )}

          {/* جدول بدلات الموظف */}
          {emp && employeeAllowanceRows.length > 0 && (
            <div className="border border-noorix-border rounded-xl overflow-hidden">
              <div className="border-b border-noorix-border font-bold py-2.5 px-3 text-[13px]">
                تفاصيل بدلات الموظف
              </div>
              {employeeAllowanceRows.map((row: HrAny, idx: HrAny) => (
                <div
                  key={`${row.label}-${idx}`}
                  className={`grid gap-3 py-2.5 px-3 text-[12px] [grid-template-columns:1.2fr_1fr] ${
                    idx === employeeAllowanceRows.length - 1 ? '' : 'border-b border-noorix-border'
                  }`}
                >
                  <div className="text-noorix-muted">{row.label}</div>
                  <div className="font-semibold text-right tabular-nums">{hrFmt(row.amount)}</div>
                </div>
              ))}
            </div>
          )}

          {/* أزرار */}
          {emp && (
            <Button
              variant="primary"
              onClick={handleUpdateSalary}
              disabled={updateMutation.isPending || basic.lte(0) || inverseWarning || !hasSelectedCentralSalary}
              className="w-full p-3 font-bold"
            >
              {updateMutation.isPending ? t('saving') : (t('salaryCalcUpdateEmployee') || 'تحديث الراتب للموظف')}
            </Button>
          )}
          <Button onClick={handlePrint} className="w-full p-2.5">
            {t('printCalc')}
          </Button>
        </div>

        {/* ── عمود النتائج ── */}
        {hasResult && (
          <div className="flex flex-col gap-3">

            {/* 1. تفصيل الراتب */}
            <div className="noorix-surface-card p-4">
              <SectionTitle>تفصيل الراتب</SectionTitle>
              <ResultRow label="الراتب الأساسي" value={<span className="text-noorix-blue">{hrFmt(basic.toNumber())} <span className="nx-sar">SR</span></span>} />
              <ResultRow label="البدلات"          value={`${hrFmt(totalAllowances.toNumber())} SR`} />
              {hasOT && (
                <ResultRow label="الأوفر تايم" value={<span className="text-noorix-green">{hrFmt(totalOTValue.toNumber())} <span className="nx-sar">SR</span></span>} />
              )}
              <ResultRow label="الإجمالي" value={<strong><FmtNum n={calculatedTotal.toNumber()} /> <span className="nx-sar">SR</span></strong>} highlight />
              {deduction.gt(0) && (
                <ResultRow label={`خصم الإجازة (${vacDays} يوم)`} value={<span className="text-noorix-red">−{hrFmt(deduction.toNumber())} SR</span>} />
              )}
              {deduction.gt(0) && (
                <ResultRow label="صافي الراتب" value={<strong><FmtNum n={netSalary.toNumber()} /> <span className="nx-sar">SR</span></strong>} highlight divider />
              )}
            </div>

            {/* 2. أجر الساعة — م107 */}
            <div className="bg-noorix-bg-muted rounded-xl p-4">
              <SectionTitle>أجر الساعة (م107)</SectionTitle>
              <ResultRow
                label={<span>أجر الساعة الفعلي <span className="text-noorix-muted text-[11px]">(أساسي+بدلات) ÷ 208</span></span>}
                value={`${hrFmt(actualHourlyRate.toNumber())} SR`}
                muted
              />
              <ResultRow
                label={<span>أجر الساعة الأساسي <span className="text-noorix-muted text-[11px]">أساسي ÷ 208</span></span>}
                value={`${hrFmt(basicHourlyRate.toNumber())} SR`}
                muted
              />
              <ResultRow
                label={<span>أجر ساعة الأوفر تايم <span className="text-noorix-amber text-[11px]">فعلي + 50% أساسي</span></span>}
                value={<span className="text-noorix-amber font-bold">{hrFmt(overtimeHourlyRate.toNumber())} SR</span>}
              />
            </div>

            {/* 3. تفصيل الساعات — فقط عند وجود OT */}
            {hasOT && (
              <div className="bg-amber-50/70 border border-amber-200/60 rounded-xl p-4">
                <SectionTitle icon="⏱">تفصيل الساعات</SectionTitle>
                <ResultRow
                  label="إجمالي ساعات العمل الفعلية"
                  value={`${totalActualHours} ساعة`}
                  muted
                />
                <ResultRow
                  label={`ساعات العمل المعيارية (${SAUDI_WORK_DAYS_STANDARD}×${SAUDI_STANDARD_HOURS})`}
                  value={`${SAUDI_STANDARD_MONTHLY_HOURS} ساعة`}
                  muted
                />
                {overtimeHoursPerDay > 0 && (
                  <ResultRow
                    label="ساعات إضافية يومية (ما فوق 8 ساعات)"
                    value={<span className="text-noorix-amber">{totalDailyOT} ساعة</span>}
                  />
                )}
                {restDays > 0 && (
                  <>
                    <ResultRow
                      label="أيام العمل بدون راحة أسبوعية"
                      value={<span className="text-noorix-amber">{restDays} يوم</span>}
                    />
                    <ResultRow
                      label="ساعات العمل في أيام الراحة"
                      value={<span className="text-noorix-amber">{totalRestOT} ساعة</span>}
                    />
                  </>
                )}
                <ResultRow
                  label="إجمالي ساعات الأوفر تايم"
                  value={<strong className="text-noorix-amber">{totalOT} ساعة</strong>}
                  highlight
                  divider
                />
              </div>
            )}

            {/* 4. قيمة الأوفر تايم — فقط عند وجود OT */}
            {hasOT && (
              <div className="bg-green-50/70 border border-green-200/60 rounded-xl p-4">
                <SectionTitle icon="💰">قيمة الأوفر تايم المستحق</SectionTitle>
                {totalDailyOT > 0 && (
                  <ResultRow
                    label="أوفر تايم الساعات الإضافية اليومية"
                    value={`${hrFmt(dailyOTValue.toNumber())} SR`}
                    muted
                  />
                )}
                {restDays > 0 && (
                  <ResultRow
                    label="أوفر تايم أيام الراحة"
                    value={`${hrFmt(restOTValue.toNumber())} SR`}
                    muted
                  />
                )}
                <ResultRow
                  label="إجمالي الأوفر تايم المستحق"
                  value={<strong className="text-noorix-green"><FmtNum n={totalOTValue.toNumber()} /> <span className="nx-sar">SR</span></strong>}
                  highlight
                  divider
                />
              </div>
            )}

            {/* 5. تنبيه — فقط عند وجود OT */}
            {hasOT && (
              <div className="flex items-start gap-2 p-3 bg-noorix-amber/10 border border-noorix-amber/25 rounded-xl">
                <span className="text-noorix-amber mt-0.5 shrink-0">⚠️</span>
                <p className="text-[12px] text-noorix-amber leading-relaxed m-0">
                  هذا الحساب يفترض أن صاحب العمل يدفع الأوفر تايم بنسبة <strong>150%</strong> حسب النظام. إذا كان يدفع بنسبة أقل، فالراتب الأساسي الفعلي سيكون أعلى.
                </p>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

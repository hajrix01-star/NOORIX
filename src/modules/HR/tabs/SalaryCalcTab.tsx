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
  DEFAULT_OVERTIME_WORK_DAYS,
  parseWorkHours,
  parseOvertimeWorkDaysPerMonth,
  mergeOvertimeWorkDaysIntoSchedule,
  computeSalaryCalculator,
} from '../utils/employeeSalaryMath';
import { employeeDisplayName } from '../../../utils/employeeDisplayName';
import { Button, Input, FormRow, usePrintPreview } from '../../../ui';
import { employeeKeys, hrKeys } from '../../../services/queryKeys';
import { HR_TOOLS_ROOT_CLASS } from '../hrWorkspaceLayout';
import { buildSalaryCalcPrintHtml } from './salaryCalcPrint';
import { SalaryCalcResultsPanel } from './SalaryCalcResultsPanel';
import type { HrCompensationSnapshot, HrCompensationSnapshotsResult, HrEmployee, HrMutationPayload } from '../../../types/api';

type SalaryCalcInputEvent = React.ChangeEvent<HTMLInputElement | HTMLSelectElement>;

type SalaryCalcCompanyRef = {
  id?: string | null;
  name?: string | null;
  nameAr?: string | null;
  logoUrl?: string | null;
};

type SalaryAllowanceRow = {
  label: string;
  amount: number;
};

type SalaryUpdateVariables = {
  id: string;
  body: HrMutationPayload;
};

function getSalaryCalcErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function SalaryCalcTab() {
  const { t, lang } = useTranslation();
  const { activeCompanyId, companies } = useApp();
  const companyId = activeCompanyId ?? '';
  const companyRefs = (companies as SalaryCalcCompanyRef[] | undefined) ?? [];
  const company = companyRefs.find((c) => c.id === companyId);
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

  const emp = employees.find((e) => e.id === selectedEmployee);
  const employeeIds = useMemo(() => employees.map((row) => row.id).filter(Boolean), [employees]);
  const {
    data: compensationSnapshots,
    isLoading: compensationSnapshotsLoading,
    error: compensationSnapshotsError,
  } = useApiQuery<HrCompensationSnapshotsResult>({
    queryKey: hrKeys.compensationSnapshots(companyId, employeeIds),
    queryFn: () => getEmployeeCompensationSnapshots(companyId, employeeIds),
    enabled: !!companyId && employeeIds.length > 0,
    fallbackMessage: t('loadingError'),
  });

  const snapshotByEmployeeId = useMemo(() => {
    const map = new Map<string, HrCompensationSnapshot>();
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
    const e = employees.find((x) => x.id === selectedEmployee);
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

  const updateMutation = useApiMutation<unknown, SalaryUpdateVariables>({
    mutationFn: async ({ id, body }: { id: string; body: HrMutationPayload }) => updateEmployee(id, body, companyId),
    invalidateQueries: [employeeKeys.root()],
    successToast: () => t('salaryCalcUpdated') || 'تم تحديث الراتب بنجاح',
    errorToast: (error: unknown) => getSalaryCalcErrorMessage(error, t('saveFailed')),
    onSuccess: (_data: unknown, variables: { id: string }) => {
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
    const rows: SalaryAllowanceRow[] = [];
    if (housing.gt(0))   rows.push({ label: t('housingAllowance'),   amount: housing.toNumber() });
    if (transport.gt(0)) rows.push({ label: t('transportAllowance'), amount: transport.toNumber() });
    if (other.gt(0))     rows.push({ label: t('otherAllowance'),     amount: other.toNumber() });
    const customRows = (selectedSnapshot?.customAllowances?.items ?? [])
      .filter((row) => Number(row.amount) > 0)
      .map((row) => ({ label: row.nameAr || row.nameEn || t('customAllowanceName'), amount: Number(row.amount) || 0 }));
    return [...rows, ...customRows];
  }, [emp, housing, transport, other, selectedSnapshot, t]);

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

  return (
    <div className={HR_TOOLS_ROOT_CLASS}>
      {printPreviewModal}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start w-full min-w-0">

        <div className="noorix-surface-card p-5 flex flex-col gap-4">
          <h3 className="text-[17px] font-bold text-noorix-text m-0">{t('hrTabSalaryCalc')}</h3>

          <Input type="select" label={t('selectEmployee')} value={selectedEmployee} onChange={(e: SalaryCalcInputEvent) => setSelectedEmployee(e.target.value)}>
            <option value="">— {t('salaryCalcSelectOrEnter') || 'اختر أو أدخل يدوياً'} —</option>
            {(!compensationSnapshotsLoading && !compensationSnapshotsError
              ? employees.filter((e) => snapshotByEmployeeId.has(e.id))
              : []
            ).map((e) => {
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

          <Input
            type="number"
            label={t('salaryCalcGross')}
            min="0"
            step="0.01"
            value={targetTotal}
            onChange={(e: SalaryCalcInputEvent) => setTargetTotal(e.target.value)}
          />

          <FormRow>
            <Input
              type="number"
              label={t('salaryCalcHoursPerDay')}
              min="1" max="12" step="0.5"
              value={hoursPerDay}
              onChange={(e: SalaryCalcInputEvent) => setHoursPerDay(e.target.value)}
            />
            <div>
              <Input
                type="number"
                label={t('salaryCalcDaysPerMonth')}
                min="1" max="31"
                value={daysPerMonth}
                onChange={(e: SalaryCalcInputEvent) => setDaysPerMonth(e.target.value)}
              />
              <div className="text-[11px] text-noorix-muted mt-1.5 leading-[1.45]">
                أيام العمل الفعلية شهرياً (26 عادية + أيام الراحة إن وُجدت)
              </div>
            </div>
          </FormRow>

          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
            <Input type="number" step="0.01" min="0" label={t('housingAllowance')}   value={housingAllowance}   onChange={(e: SalaryCalcInputEvent) => setHousingAllowance(e.target.value)} />
            <Input type="number" step="0.01" min="0" label={t('transportAllowance')} value={transportAllowance} onChange={(e: SalaryCalcInputEvent) => setTransportAllowance(e.target.value)} />
            <Input type="number" step="0.01" min="0" label={t('otherAllowance')}     value={otherAllowance}     onChange={(e: SalaryCalcInputEvent) => setOtherAllowance(e.target.value)} />
          </div>

          <FormRow>
            <Input type="number" min="0" label={t('salaryCalcVacationDays')} value={vacationDays} onChange={(e: SalaryCalcInputEvent) => setVacationDays(e.target.value)} />
            <Input type="number" label="ساعات الأوفر تايم اليومية" value={overtimeHoursPerDay} readOnly className="bg-noorix-bg-muted" />
          </FormRow>

          {inverseWarning && (
            <div className="text-[12px] text-noorix-amber bg-noorix-amber/10 border border-noorix-amber/30 rounded-lg px-3 py-2">
              الإجمالي المستهدف أقل من مجموع البدلات مع ساعات الأوفر تايم المحددة. خفّف البدلات أو زد الإجمالي.
            </div>
          )}

          {emp && employeeAllowanceRows.length > 0 && (
            <div className="border border-noorix-border rounded-xl overflow-hidden">
              <div className="border-b border-noorix-border font-bold py-2.5 px-3 text-[13px]">
                تفاصيل بدلات الموظف
              </div>
              {employeeAllowanceRows.map((row, idx) => (
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

        {hasResult && (
          <SalaryCalcResultsPanel
            t={t}
            vacDays={vacDays}
            workDays={workDays}
            restDays={restDays}
            overtimeHoursPerDay={overtimeHoursPerDay}
            totalActualHours={totalActualHours}
            totalDailyOT={totalDailyOT}
            totalRestOT={totalRestOT}
            totalOT={totalOT}
            basic={basic}
            totalAllowances={totalAllowances}
            deduction={deduction}
            actualHourlyRate={actualHourlyRate}
            basicHourlyRate={basicHourlyRate}
            overtimeHourlyRate={overtimeHourlyRate}
            dailyOTValue={dailyOTValue}
            restOTValue={restOTValue}
            totalOTValue={totalOTValue}
            calculatedTotal={calculatedTotal}
            netSalary={netSalary}
            hasOT={hasOT}
          />
        )}
      </div>
    </div>
  );
}

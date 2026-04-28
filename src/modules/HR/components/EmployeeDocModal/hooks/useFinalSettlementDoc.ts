import { useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { getSaudiToday } from '../../../../../utils/saudiDate';
import { parseWorkHours, SAUDI_STANDARD_HOURS } from '../../../utils/employeeSalaryMath';
import {
  buildSalaryRows,
  buildSettlementDeclaration,
  calculateServiceDays,
  getEligibilityFactor,
  getTerminationSummary,
} from '../utils/employeeDocBuilders';

export function useFinalSettlementDoc(
  employee: Record<string, unknown>,
  customAllowances: Array<Record<string, unknown>> = [],
) {
  const { rows, total } = useMemo(() => buildSalaryRows(employee, customAllowances), [employee, customAllowances]);
  const lastMonthlyComp = total;
  const termination = useMemo(() => getTerminationSummary(employee), [employee]);
  const [includeEos, setIncludeEos] = useState(true);
  const [eosEndDate, setEosEndDate] = useState(termination.terminationDate || getSaudiToday());
  const [eosReason, setEosReason] = useState(termination.reasonCode || 'employer');
  const [eosSalary, setEosSalary] = useState(String(lastMonthlyComp || 0));
  const overtimeHoursPerDay = Math.max(0, parseWorkHours(employee?.workHours) - SAUDI_STANDARD_HOURS);

  useEffect(() => {
    setEosEndDate(termination.terminationDate || getSaudiToday());
    setEosReason(termination.reasonCode || 'employer');
    setEosSalary(new Decimal(lastMonthlyComp || 0).toDecimalPlaces(2).toString());
  }, [termination.terminationDate, termination.reasonCode, lastMonthlyComp]);

  const eos = useMemo(() => {
    const endDate = eosEndDate || termination.terminationDate || getSaudiToday();
    const serviceDays = calculateServiceDays(employee?.joinDate, endDate);
    const serviceYears = new Decimal(serviceDays).div(360);
    const firstFiveYears = Decimal.min(serviceYears, 5);
    const remainingYears = Decimal.max(serviceYears.minus(5), 0);
    const wageForEos = new Decimal(eosSalary || lastMonthlyComp || 0);
    const fullAward = wageForEos.times(firstFiveYears).times(0.5).plus(wageForEos.times(remainingYears));
    const eligibilityFactor = getEligibilityFactor(eosReason, serviceYears.toNumber());
    const eosAmount = fullAward.times(eligibilityFactor);
    const appliedEosAmount = includeEos ? eosAmount : new Decimal(0);
    return {
      serviceDays,
      serviceYears: serviceYears.toDecimalPlaces(2).toNumber(),
      wageForEos: wageForEos.toNumber(),
      fullAward: fullAward.toNumber(),
      factorPct: eligibilityFactor.times(100).toDecimalPlaces(2).toNumber(),
      eosAmount: eosAmount.toNumber(),
      appliedEosAmount: appliedEosAmount.toNumber(),
      finalTotal: appliedEosAmount.plus(lastMonthlyComp).toNumber(),
    };
  }, [employee?.joinDate, eosEndDate, eosReason, eosSalary, includeEos, lastMonthlyComp, termination.terminationDate]);

  const settlementDeclaration = useMemo(
    () => buildSettlementDeclaration(includeEos, termination),
    [includeEos, termination],
  );

  return {
    rows,
    total,
    lastMonthlyComp,
    termination,
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
  };
}

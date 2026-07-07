import { useEffect, useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { getSaudiToday } from '../../../../../utils/saudiDate';
import {
  buildSalaryRows,
  buildSettlementDeclaration,
  getTerminationSummary,
} from '../utils/employeeDocBuilders';
import {
  computeEos,
} from '../../../utils/hrCalculations/eos';
import type { HrCompensationSnapshot } from '../../../../../types/api';

export function useFinalSettlementDoc(
  employee: Record<string, unknown>,
  compensationSnapshot: HrCompensationSnapshot,
) {
  const { rows, total } = useMemo(() => buildSalaryRows(compensationSnapshot), [compensationSnapshot]);
  const lastMonthlyComp = total;
  const termination = useMemo(() => getTerminationSummary(employee), [employee]);
  const [includeEos, setIncludeEos] = useState(true);
  const [eosEndDate, setEosEndDate] = useState(termination.terminationDate || getSaudiToday());
  const [eosReason, setEosReason] = useState(termination.reasonCode || 'employer');
  const [eosSalary, setEosSalary] = useState(String(lastMonthlyComp || 0));
  const overtimeHoursPerDay = Number(compensationSnapshot?.salaryPackage?.overtimeHoursPerDay ?? 0);
  const eosWage = useMemo(
    () => new Decimal(compensationSnapshot?.salaryPackage?.fixedTotal ?? 0),
    [compensationSnapshot],
  );

  useEffect(() => {
    setEosEndDate(termination.terminationDate || getSaudiToday());
    setEosReason(termination.reasonCode || 'employer');
    setEosSalary(eosWage.toDecimalPlaces(2).toString());
  }, [termination.terminationDate, termination.reasonCode, eosWage]);

  const eos = useMemo(() => {
    const endDate = eosEndDate || termination.terminationDate || getSaudiToday();
    const wageForEos = new Decimal(eosSalary || lastMonthlyComp || 0);
    const calc = computeEos({
      joinDate: employee?.joinDate as string | Date | null | undefined,
      endDate,
      wage: wageForEos,
      reason: eosReason,
    });
    const appliedEosAmount = includeEos ? calc.eosAmount : new Decimal(0);
    return {
      serviceDays: calc.serviceDays,
      serviceYears: calc.serviceYears.toDecimalPlaces(2).toNumber(),
      wageForEos: wageForEos.toNumber(),
      fullAward: calc.fullAward.toNumber(),
      factorPct: calc.eligibilityFactor.times(100).toDecimalPlaces(2).toNumber(),
      eosAmount: calc.eosAmount.toNumber(),
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

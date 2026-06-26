import Decimal from 'decimal.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export type EosReason =
  | 'employer'
  | 'resignation'
  | 'article80'
  | 'article81'
  | 'force_majeure'
  | 'maternity';

export type EosInput = {
  joinDate: string | Date | null | undefined;
  endDate: string | Date | null | undefined;
  wage: Decimal.Value;
  reason: EosReason | string;
};

export type EosResult = {
  serviceDays: number;
  serviceYears: Decimal;
  firstFiveYears: Decimal;
  remainingYears: Decimal;
  fullAward: Decimal;
  eligibilityFactor: Decimal;
  eosAmount: Decimal;
};

function normalizeDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Official Noorix EOS policy source.
 *
 * Matches the approved Salary Tools EOS calculator:
 * - Actual day difference only, no inclusive +1.
 * - Service years use Gregorian year basis: days / 365.
 */
export function calculateEosServiceDays(joinDate: EosInput['joinDate'], endDate: EosInput['endDate']): number {
  const start = normalizeDate(joinDate);
  const end = normalizeDate(endDate);
  if (!start || !end || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / DAY_MS);
}

export function getEosServiceComponents(joinDate: EosInput['joinDate'], endDate: EosInput['endDate']) {
  const start = normalizeDate(joinDate);
  const end = normalizeDate(endDate);
  if (!start || !end || end < start) return { years: 0, months: 0, days: 0 };

  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    months -= 1;
    days += new Date(end.getFullYear(), end.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

export function getEosEligibilityFactor(reason: EosReason | string, serviceYears: Decimal.Value): Decimal {
  const years = new Decimal(serviceYears || 0);
  if (reason === 'article80') return new Decimal(0);
  if (
    reason === 'employer' ||
    reason === 'article81' ||
    reason === 'force_majeure' ||
    reason === 'maternity'
  ) {
    return new Decimal(1);
  }
  if (years.lt(2)) return new Decimal(0);
  if (years.lte(5)) return new Decimal(1).div(3);
  if (years.lt(10)) return new Decimal(2).div(3);
  return new Decimal(1);
}

export function computeEos(input: EosInput): EosResult {
  const serviceDays = calculateEosServiceDays(input.joinDate, input.endDate);
  const serviceYears = new Decimal(serviceDays).div(365);
  const firstFiveYears = Decimal.min(serviceYears, 5);
  const remainingYears = Decimal.max(serviceYears.minus(5), 0);
  const wage = new Decimal(input.wage || 0);
  const fullAward = wage.times(firstFiveYears).times(0.5).plus(wage.times(remainingYears));
  const eligibilityFactor = getEosEligibilityFactor(input.reason, serviceYears);
  const eosAmount = fullAward.times(eligibilityFactor);

  return {
    serviceDays,
    serviceYears,
    firstFiveYears,
    remainingYears,
    fullAward,
    eligibilityFactor,
    eosAmount,
  };
}

export function computeEosWageFromEmployee(
  employee: Record<string, unknown> | null | undefined,
  customAllowanceTotal: Decimal.Value = 0,
): Decimal {
  return new Decimal((employee?.basicSalary as Decimal.Value | undefined) ?? 0)
    .plus((employee?.housingAllowance as Decimal.Value | undefined) ?? 0)
    .plus((employee?.transportAllowance as Decimal.Value | undefined) ?? 0)
    .plus((employee?.otherAllowance as Decimal.Value | undefined) ?? 0)
    .plus(customAllowanceTotal || 0);
}


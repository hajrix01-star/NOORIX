import { toYmd } from '../../../utils/saudiDate';

export interface DashboardPeriodApiParams {
  companyId: string;
  year: number;
  yearStart: string;
  yearEnd: string;
  periodStart: string;
  periodEnd: string;
  dailyStart?: string | null;
  dailyEnd?: string | null;
  monthStart?: string | null;
  monthEnd?: string | null;
  weeklyYearStart?: string | null;
  weeklyYearEnd?: string | null;
  weeklyStart?: string | null;
  weeklyEnd?: string | null;
  weeklyBaselineStart?: string | null;
  weeklyBaselineEnd?: string | null;
  previousMonthYearStart?: string | null;
  previousMonthYearEnd?: string | null;
  previousMonthStart?: string | null;
  previousMonthEnd?: string | null;
  selectedMonth?: number | null;
  includeCancelledSales?: boolean;
}

export interface DashboardPeriodQueryKeyInput {
  companyId: string;
  year: number;
  yearStart: string;
  yearEnd: string;
  periodStart: string;
  periodEnd: string;
  dailyStart: string | null;
  dailyEnd: string | null;
  monthStart: string | null;
  monthEnd: string | null;
  weeklyYearStart?: string | null;
  weeklyYearEnd?: string | null;
  weeklyStart?: string | null;
  weeklyEnd?: string | null;
  weeklyBaselineStart?: string | null;
  weeklyBaselineEnd?: string | null;
  previousMonthYearStart?: string | null;
  previousMonthYearEnd?: string | null;
  previousMonthStart?: string | null;
  previousMonthEnd?: string | null;
  selectedMonth: number | null;
  includeCancelledSales: boolean;
}

export function normalizeDashboardPeriodKeyInput(params: DashboardPeriodApiParams): DashboardPeriodQueryKeyInput {
  return {
    companyId: String(params.companyId ?? '').trim(),
    year: params.year,
    yearStart: toYmd(params.yearStart),
    yearEnd: toYmd(params.yearEnd),
    periodStart: toYmd(params.periodStart),
    periodEnd: toYmd(params.periodEnd),
    dailyStart: optionalYmd(params.dailyStart),
    dailyEnd: optionalYmd(params.dailyEnd),
    monthStart: optionalYmd(params.monthStart),
    monthEnd: optionalYmd(params.monthEnd),
    weeklyYearStart: optionalYmd(params.weeklyYearStart),
    weeklyYearEnd: optionalYmd(params.weeklyYearEnd),
    weeklyStart: optionalYmd(params.weeklyStart),
    weeklyEnd: optionalYmd(params.weeklyEnd),
    weeklyBaselineStart: optionalYmd(params.weeklyBaselineStart),
    weeklyBaselineEnd: optionalYmd(params.weeklyBaselineEnd),
    previousMonthYearStart: optionalYmd(params.previousMonthYearStart),
    previousMonthYearEnd: optionalYmd(params.previousMonthYearEnd),
    previousMonthStart: optionalYmd(params.previousMonthStart),
    previousMonthEnd: optionalYmd(params.previousMonthEnd),
    selectedMonth:
      params.selectedMonth != null && params.selectedMonth >= 1 && params.selectedMonth <= 12
        ? params.selectedMonth
        : null,
    includeCancelledSales: params.includeCancelledSales === true,
  };
}

export function hasRequiredDashboardPeriodParams(params: DashboardPeriodApiParams): boolean {
  const query = normalizeDashboardPeriodKeyInput(params);
  return (
    !!query.companyId &&
    Number.isFinite(query.year) &&
    query.year >= 2000 &&
    query.year <= 2100 &&
    !!query.yearStart &&
    !!query.yearEnd &&
    !!query.periodStart &&
    !!query.periodEnd
  );
}

export function buildDashboardPeriodQuery(params: DashboardPeriodApiParams): Record<string, string | number | boolean> {
  const normalized = normalizeDashboardPeriodKeyInput(params);
  const query: Record<string, string | number | boolean> = {
    companyId: normalized.companyId,
    year: normalized.year,
    yearStart: normalized.yearStart,
    yearEnd: normalized.yearEnd,
    periodStart: normalized.periodStart,
    periodEnd: normalized.periodEnd,
  };

  addOptionalQueryValue(query, 'dailyStart', normalized.dailyStart);
  addOptionalQueryValue(query, 'dailyEnd', normalized.dailyEnd);
  addOptionalQueryValue(query, 'monthStart', normalized.monthStart);
  addOptionalQueryValue(query, 'monthEnd', normalized.monthEnd);
  addOptionalQueryValue(query, 'weeklyYearStart', normalized.weeklyYearStart);
  addOptionalQueryValue(query, 'weeklyYearEnd', normalized.weeklyYearEnd);
  addOptionalQueryValue(query, 'weeklyStart', normalized.weeklyStart);
  addOptionalQueryValue(query, 'weeklyEnd', normalized.weeklyEnd);
  addOptionalQueryValue(query, 'weeklyBaselineStart', normalized.weeklyBaselineStart);
  addOptionalQueryValue(query, 'weeklyBaselineEnd', normalized.weeklyBaselineEnd);
  addOptionalQueryValue(query, 'previousMonthYearStart', normalized.previousMonthYearStart);
  addOptionalQueryValue(query, 'previousMonthYearEnd', normalized.previousMonthYearEnd);
  addOptionalQueryValue(query, 'previousMonthStart', normalized.previousMonthStart);
  addOptionalQueryValue(query, 'previousMonthEnd', normalized.previousMonthEnd);

  if (normalized.selectedMonth != null) {
    query.selectedMonth = normalized.selectedMonth;
  }
  if (normalized.includeCancelledSales) {
    query.includeCancelledSales = true;
  }

  return query;
}

function optionalYmd(value: string | null | undefined): string | null {
  const ymd = value != null && value !== '' ? toYmd(value) : '';
  return ymd || null;
}

function addOptionalQueryValue(
  query: Record<string, string | number | boolean>,
  key:
    | 'dailyStart'
    | 'dailyEnd'
    | 'monthStart'
    | 'monthEnd'
    | 'weeklyYearStart'
    | 'weeklyYearEnd'
    | 'weeklyStart'
    | 'weeklyEnd'
    | 'weeklyBaselineStart'
    | 'weeklyBaselineEnd'
    | 'previousMonthYearStart'
    | 'previousMonthYearEnd'
    | 'previousMonthStart'
    | 'previousMonthEnd',
  value: string | null | undefined,
) {
  if (value) {
    query[key] = value;
  }
}

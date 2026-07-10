import {
  resolveDatePeriodRange,
  toYmdOnly,
  type DatePeriodState,
} from '../../utils/datePeriod';

export type DashboardPeriodFilter = {
  year: number;
  selectedMonth: number | null;
  label: string;
  periodStart: string;
  periodEnd: string;
  isCustomRange: boolean;
};

export function buildDashboardYearOptions(currentYear: number, count = 3): number[] {
  const safeCount = Math.max(1, Math.floor(count));
  return Array.from({ length: safeCount }, (_, index) => currentYear - index);
}

export function parseDashboardMonthValue(month: string | number | null | undefined): number | null {
  const raw = String(month ?? '').trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

export function buildDashboardPeriodFilter(
  year: number,
  selectedMonth: number | null,
  label: string,
  periodStart: string,
  periodEnd: string,
  isCustomRange: boolean,
): DashboardPeriodFilter {
  const safeMonth = selectedMonth != null && selectedMonth >= 1 && selectedMonth <= 12 ? selectedMonth : null;
  return {
    year,
    selectedMonth: safeMonth,
    label,
    periodStart,
    periodEnd,
    isCustomRange,
  };
}

export function deriveDashboardPeriodFromDateFilter(
  state: DatePeriodState,
  fallback: { year: number; month: number; day: number },
): Pick<DashboardPeriodFilter, 'year' | 'selectedMonth' | 'periodStart' | 'periodEnd' | 'isCustomRange'> {
  const range = resolveDatePeriodRange(state, fallback);
  const periodStart = toYmdOnly(range.startDate);
  const periodEnd = toYmdOnly(range.endDate);
  const firstPeriodMonth = parseYmdMonth(periodStart);

  if (state.mode === 'day' && state.selDay) {
    const parsed = parseYmdMonth(state.selDay);
    if (parsed) return { ...parsed, periodStart, periodEnd, isCustomRange: true };
  }

  if (state.mode === 'month' || state.mode === 'months') {
    const sameMonth =
      state.monthRangeStartYear === state.monthRangeEndYear &&
      state.monthRangeStartMonth === state.monthRangeEndMonth;
    return {
      year: state.monthRangeStartYear || state.selYear || fallback.year,
      selectedMonth: sameMonth ? parseDashboardMonthValue(state.monthRangeStartMonth) : null,
      periodStart,
      periodEnd,
      isCustomRange: !sameMonth,
    };
  }

  if (state.mode === 'range') {
    return {
      year: firstPeriodMonth?.year ?? state.selYear ?? fallback.year,
      selectedMonth: null,
      periodStart,
      periodEnd,
      isCustomRange: true,
    };
  }

  if (state.mode === 'quarter' || state.mode === 'year' || state.mode === 'all') {
    return {
      year: state.selYear || fallback.year,
      selectedMonth: null,
      periodStart,
      periodEnd,
      isCustomRange: state.mode === 'quarter',
    };
  }

  return {
    year: fallback.year,
    selectedMonth: fallback.month,
    periodStart,
    periodEnd,
    isCustomRange: false,
  };
}

function parseYmdMonth(value: string): Pick<DashboardPeriodFilter, 'year' | 'selectedMonth'> | null {
  const [year, month] = value.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  return { year, selectedMonth: parseDashboardMonthValue(month) };
}

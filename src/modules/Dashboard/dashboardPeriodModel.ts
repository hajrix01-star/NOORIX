import type { DatePeriodState } from '../../utils/datePeriod';

export type DashboardPeriodFilter = {
  year: number;
  selectedMonth: number | null;
  label: string;
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
): DashboardPeriodFilter {
  const safeMonth = selectedMonth != null && selectedMonth >= 1 && selectedMonth <= 12 ? selectedMonth : null;
  return {
    year,
    selectedMonth: safeMonth,
    label,
  };
}

export function deriveDashboardPeriodFromDateFilter(
  state: DatePeriodState,
  fallback: { year: number; month: number },
): Pick<DashboardPeriodFilter, 'year' | 'selectedMonth'> {
  if (state.mode === 'day' && state.selDay) {
    const parsed = parseYmdMonth(state.selDay);
    if (parsed) return parsed;
  }

  if (state.mode === 'month' || state.mode === 'months') {
    const sameMonth =
      state.monthRangeStartYear === state.monthRangeEndYear &&
      state.monthRangeStartMonth === state.monthRangeEndMonth;
    return {
      year: state.monthRangeStartYear || state.selYear || fallback.year,
      selectedMonth: sameMonth ? parseDashboardMonthValue(state.monthRangeStartMonth) : null,
    };
  }

  if (state.mode === 'quarter' || state.mode === 'year' || state.mode === 'range' || state.mode === 'all') {
    return {
      year: state.selYear || fallback.year,
      selectedMonth: null,
    };
  }

  return { year: fallback.year, selectedMonth: fallback.month };
}

function parseYmdMonth(value: string): Pick<DashboardPeriodFilter, 'year' | 'selectedMonth'> | null {
  const [year, month] = value.split('-').map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  return { year, selectedMonth: parseDashboardMonthValue(month) };
}

import type { DatePeriodState } from '../../../utils/datePeriod';

export type OwnerDashboardPeriod = {
  year: number;
  selectedMonth: number | null;
};

export function deriveOwnerDashboardPeriodFromDateFilter(
  state: DatePeriodState,
  fallback: { year: number; month: number },
): OwnerDashboardPeriod {
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
      selectedMonth: sameMonth ? normalizeMonth(state.monthRangeStartMonth) : null,
    };
  }

  return {
    year: state.selYear || fallback.year,
    selectedMonth: null,
  };
}

function parseYmdMonth(value: string): OwnerDashboardPeriod | null {
  const [year, month] = value.split('-').map(Number);
  if (!Number.isInteger(year)) return null;
  return { year, selectedMonth: normalizeMonth(month) };
}

function normalizeMonth(value: number): number | null {
  return Number.isInteger(value) && value >= 1 && value <= 12 ? value : null;
}

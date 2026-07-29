import type { DatePeriodState } from '../../utils/datePeriod';
import { getProfitLossCardRawValue, type ProfitLossKpiKey } from './profitLossPresentationModel';
import type { GeneralProfitLossReport, PlDisplayRow } from './reportTypes';

export type ComparablePeriod = {
  mode: 'all' | 'month' | 'months' | 'quarter' | 'year' | 'range';
  year: number;
  month: number | null;
  monthStart: number;
  monthEnd: number;
  months?: number[];
};

export type ComparisonColumnPeriod = {
  key: string;
  label: string;
  period: ComparablePeriod;
};

export function deriveComparablePeriod(state: DatePeriodState): ComparablePeriod {
  if (state.mode === 'all') {
    return { mode: 'all', year: state.selYear, month: null, monthStart: 1, monthEnd: 12 };
  }
  if (state.mode === 'year') {
    return { mode: 'year', year: state.selYear, month: null, monthStart: 1, monthEnd: 12 };
  }
  if (state.mode === 'quarter') {
    const start = (state.selQuarter - 1) * 3 + 1;
    return { mode: 'quarter', year: state.selYear, month: null, monthStart: start, monthEnd: start + 2 };
  }
  if (state.mode === 'month' || state.mode === 'months') {
    const sameMonth =
      state.monthRangeStartYear === state.monthRangeEndYear &&
      state.monthRangeStartMonth === state.monthRangeEndMonth;
    return {
      mode: sameMonth ? 'month' : 'months',
      year: state.monthRangeStartYear || state.selYear,
      month: sameMonth ? state.monthRangeStartMonth : null,
      monthStart: Math.min(state.monthRangeStartMonth, state.monthRangeEndMonth),
      monthEnd: Math.max(state.monthRangeStartMonth, state.monthRangeEndMonth),
    };
  }
  if (state.mode === 'range') {
    const start = parseYearMonth(state.rangeStart, state.selYear, state.selMonth);
    const end = parseYearMonth(state.rangeEnd, start.year, start.month);
    const sameMonth = start.year === end.year && start.month === end.month;
    return {
      mode: sameMonth ? 'month' : 'range',
      year: start.year,
      month: sameMonth ? start.month : null,
      monthStart: Math.min(start.month, end.month),
      monthEnd: Math.max(start.month, end.month),
    };
  }
  return { mode: 'month', year: state.selYear, month: state.selMonth, monthStart: state.selMonth, monthEnd: state.selMonth };
}

export function applyCustomCompareMonths(period: ComparablePeriod, months: number[]): ComparablePeriod {
  const normalizedMonths = normalizeMonths(months);
  const canCustomize = period.mode === 'month' || period.mode === 'months';
  if (!canCustomize || normalizedMonths.length === 0) return period;
  return {
    ...period,
    mode: normalizedMonths.length === 1 ? 'month' : 'months',
    month: normalizedMonths.length === 1 ? normalizedMonths[0] : null,
    monthStart: normalizedMonths[0],
    monthEnd: normalizedMonths[normalizedMonths.length - 1],
    months: normalizedMonths,
  };
}

export function buildCompareColumnPeriods(
  period: ComparablePeriod,
  monthNames: string[],
  periodLabel: string,
): ComparisonColumnPeriod[] {
  if (period.mode === 'all') return [];
  if (period.months?.length) {
    return period.months.map((month) => ({
      key: `compare-${period.year}-${month}`,
      label: `${monthNames[month - 1]} ${period.year}`,
      period: {
        ...period,
        mode: 'month',
        month,
        monthStart: month,
        monthEnd: month,
        months: undefined,
      },
    }));
  }
  return [{
    key: `compare-${period.year}-${period.mode}-${period.monthStart}-${period.monthEnd}`,
    label: `${period.year} ${periodLabel}`,
    period,
  }];
}

export function rowIdentity(row: PlDisplayRow) {
  return `${row.groupKey || ''}:${row.itemKey || row.key || ''}:${row.rowType || ''}:${row.depth || 0}`;
}

export function buildRowMap(rows: PlDisplayRow[]) {
  const map = new Map<string, PlDisplayRow>();
  for (const row of rows) map.set(rowIdentity(row), row);
  return map;
}

export function numericAmount(value: unknown) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function periodAmount(row: PlDisplayRow, period: ComparablePeriod) {
  if (period.mode === 'year' || period.mode === 'all') return numericAmount(row.total);
  if (period.mode === 'month' && period.month) return numericAmount(row.months?.[period.month - 1]);
  const months = period.months?.length ? period.months : monthRange(period.monthStart, period.monthEnd);
  return months.reduce((total, month) => total + numericAmount(row.months?.[month - 1]), 0);
}

export function cardAmount(
  report: GeneralProfitLossReport | null | undefined,
  key: ProfitLossKpiKey,
  period: ComparablePeriod,
) {
  if (period.mode === 'year' || period.mode === 'all') return getProfitLossCardRawValue(report, key, null);
  if (period.mode === 'month' && period.month) return getProfitLossCardRawValue(report, key, period.month);
  const row = [
    ...(report?.groups || []),
    ...(report?.summaryRows || []),
  ].find((item) => item.key === key);
  if (!row) return 0;
  const months = period.months?.length ? period.months : monthRange(period.monthStart, period.monthEnd);
  return months.reduce((total, month) => total + numericAmount(row.months?.[month - 1]), 0);
}

export function reportYear(report: GeneralProfitLossReport | null | undefined, fallbackYear: number) {
  const firstLabel = report?.months?.[0]?.label || '';
  const match = String(firstLabel).match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : fallbackYear;
}

function parseYearMonth(value: string, fallbackYear: number, fallbackMonth: number) {
  const [year, month] = String(value || '').split('-').map(Number);
  return {
    year: Number.isFinite(year) && year > 0 ? year : fallbackYear,
    month: Number.isFinite(month) && month >= 1 && month <= 12 ? month : fallbackMonth,
  };
}

function normalizeMonths(months: number[]) {
  return [...new Set(months)].filter((month) => month >= 1 && month <= 12).sort((a, b) => a - b);
}

function monthRange(start: number, end: number) {
  const normalizedStart = Math.max(1, Math.min(12, start));
  const normalizedEnd = Math.max(normalizedStart, Math.min(12, end));
  return Array.from({ length: normalizedEnd - normalizedStart + 1 }, (_, index) => normalizedStart + index);
}

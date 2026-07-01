import { describe, expect, it } from 'vitest';
import {
  buildDatePeriodLabel,
  listYearMonthsInRange,
  resolveDatePeriodRange,
  type DatePeriodState,
} from './datePeriod';

const now = { year: 2026, month: 6, day: 30 };

function state(overrides: Partial<DatePeriodState>): DatePeriodState {
  return {
    mode: 'month',
    selYear: 2026,
    selMonth: 6,
    selDay: '2026-06-30',
    rangeStart: '2026-06-01',
    rangeEnd: '2026-06-30',
    monthRangeStartYear: 2026,
    monthRangeStartMonth: 4,
    monthRangeEndYear: 2026,
    monthRangeEndMonth: 6,
    ...overrides,
  };
}

describe('datePeriod', () => {
  it('resolves one month to first and last day', () => {
    expect(resolveDatePeriodRange(state({ mode: 'month', selMonth: 2 }), now)).toEqual({
      startDate: '2026-02-01T00:00:00+03:00',
      endDate: '2026-02-28T23:59:59+03:00',
    });
  });

  it('resolves multiple months as whole calendar months', () => {
    expect(resolveDatePeriodRange(state({ mode: 'months' }), now)).toEqual({
      startDate: '2026-04-01T00:00:00+03:00',
      endDate: '2026-06-30T23:59:59+03:00',
    });
  });

  it('normalizes reversed multiple month selection', () => {
    expect(resolveDatePeriodRange(state({
      mode: 'months',
      monthRangeStartYear: 2026,
      monthRangeStartMonth: 6,
      monthRangeEndYear: 2026,
      monthRangeEndMonth: 4,
    }), now)).toEqual({
      startDate: '2026-04-01T00:00:00+03:00',
      endDate: '2026-06-30T23:59:59+03:00',
    });
  });

  it('resolves year to full year', () => {
    expect(resolveDatePeriodRange(state({ mode: 'year', selYear: 2025 }), now)).toEqual({
      startDate: '2025-01-01T00:00:00+03:00',
      endDate: '2025-12-31T23:59:59+03:00',
    });
  });

  it('lists year-month keys included in a date range', () => {
    expect(listYearMonthsInRange('2025-11-20', '2026-02-02').map((x) => x.key)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('builds a useful label for multiple months', () => {
    expect(buildDatePeriodLabel(state({ mode: 'months' }), now)).toBe('Apr 2026 - Jun 2026');
  });

  it('builds a compact label when month range is one month', () => {
    expect(buildDatePeriodLabel(state({
      mode: 'months',
      monthRangeStartMonth: 6,
      monthRangeEndMonth: 6,
    }), now)).toBe('Jun 2026');
  });
});

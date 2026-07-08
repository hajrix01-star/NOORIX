import { describe, expect, it } from 'vitest';
import type { DatePeriodState } from '../../../utils/datePeriod';
import { deriveOwnerDashboardPeriodFromDateFilter } from './ownerDashboardPeriodModel';

const baseState: DatePeriodState = {
  mode: 'months',
  selYear: 2026,
  selMonth: 7,
  selQuarter: 3,
  selDay: '2026-07-08',
  rangeStart: '2026-07-01',
  rangeEnd: '2026-07-08',
  monthRangeStartYear: 2026,
  monthRangeStartMonth: 7,
  monthRangeEndYear: 2026,
  monthRangeEndMonth: 7,
  yearRangeStart: 2026,
  yearRangeEnd: 2026,
};

describe('ownerDashboardPeriodModel', () => {
  it('derives owner dashboard period from the full central date filter', () => {
    expect(deriveOwnerDashboardPeriodFromDateFilter(baseState, { year: 2026, month: 7 })).toEqual({
      year: 2026,
      selectedMonth: 7,
    });

    expect(deriveOwnerDashboardPeriodFromDateFilter({ ...baseState, mode: 'day', selDay: '2025-12-03' }, { year: 2026, month: 7 })).toEqual({
      year: 2025,
      selectedMonth: 12,
    });

    expect(deriveOwnerDashboardPeriodFromDateFilter({ ...baseState, mode: 'quarter' }, { year: 2026, month: 7 })).toEqual({
      year: 2026,
      selectedMonth: null,
    });
  });
});

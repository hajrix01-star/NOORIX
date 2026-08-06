import { describe, expect, it } from 'vitest';
import { type DatePeriodState } from './datePeriod';
import { getDatePeriodModeChange } from './datePeriodDraft';

const baseDraft: DatePeriodState = {
  mode: 'all',
  selYear: 2026,
  selMonth: 7,
  selQuarter: 3,
  selDay: '',
  rangeStart: '',
  rangeEnd: '',
  monthRangeStartYear: 2026,
  monthRangeStartMonth: 7,
  monthRangeEndYear: 2026,
  monthRangeEndMonth: 7,
  yearRangeStart: 2026,
  yearRangeEnd: 2026,
};

describe('date period draft helpers', () => {
  it('prepares a day filter with a Riyadh fallback day', () => {
    const change = getDatePeriodModeChange(baseDraft, 'day', { year: 2026, month: 7, day: 4 });

    expect(change.openPanel).toBe('day');
    expect(change.patch).toMatchObject({
      mode: 'day',
      rangeStart: '2026-07-04',
      rangeEnd: '2026-07-04',
    });
  });

  it('opens month mode as a single-month selection by default', () => {
    const change = getDatePeriodModeChange(baseDraft, 'month', { year: 2026, month: 7, day: 4 });

    expect(change.openPanel).toBe('month');
    expect(change.patch).toMatchObject({
      mode: 'month',
      selYear: 2026,
      selMonth: 7,
      monthRangeStartYear: 2026,
      monthRangeStartMonth: 7,
      monthRangeEndYear: 2026,
      monthRangeEndMonth: 7,
    });
  });

  it('prepares a quarter filter without calculating dates in the UI', () => {
    const change = getDatePeriodModeChange(baseDraft, 'quarter', { year: 2026, month: 7, day: 4 });

    expect(change.openPanel).toBe('quarter');
    expect(change.patch).toMatchObject({ mode: 'quarter', selYear: 2026, selQuarter: 3 });
  });
});

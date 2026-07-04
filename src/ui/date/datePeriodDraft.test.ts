import { describe, expect, it } from 'vitest';
import { type DatePeriodState } from './datePeriod';
import { getDatePeriodModeChange } from './datePeriodDraft';

const baseDraft: DatePeriodState = {
  mode: 'all',
  selYear: 2026,
  selMonth: 7,
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

  it('normalizes the month UI mode into the months period mode', () => {
    const change = getDatePeriodModeChange(baseDraft, 'month', { year: 2026, month: 7, day: 4 });

    expect(change.openPanel).toBe('month');
    expect(change.patch).toMatchObject({ mode: 'months' });
  });
});

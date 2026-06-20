import { describe, expect, it } from 'vitest';
import {
  compareYmd,
  findDuplicateShiftsForDate,
  isDayShiftCoverageComplete,
  listGapDaysBetween,
  shiftConflictsWithDay,
  suggestSalesEntryDate,
} from './suggestSalesEntryDate';

describe('suggestSalesEntryDate', () => {
  it('suggests today when no prior entry', () => {
    expect(suggestSalesEntryDate('2026-06-22', null)).toBe('2026-06-22');
  });

  it('suggests next day after last complete entry when behind', () => {
    expect(suggestSalesEntryDate('2026-06-22', '2026-06-18', ['all'])).toBe('2026-06-19');
  });

  it('suggests today when last entry was yesterday (complete)', () => {
    expect(suggestSalesEntryDate('2026-06-22', '2026-06-21', ['morning', 'evening'])).toBe('2026-06-22');
  });

  it('stays on same day when last entry has only morning shift', () => {
    expect(suggestSalesEntryDate('2026-06-22', '2026-06-20', ['morning'])).toBe('2026-06-20');
  });

  it('suggests today when last entry is today and complete', () => {
    expect(suggestSalesEntryDate('2026-06-22', '2026-06-22', ['all'])).toBe('2026-06-22');
  });
});

describe('listGapDaysBetween', () => {
  it('returns days between last entry and target', () => {
    const { days, totalCount } = listGapDaysBetween('2026-06-18', '2026-06-22');
    expect(days).toEqual(['2026-06-19', '2026-06-20', '2026-06-21']);
    expect(totalCount).toBe(3);
  });

  it('returns empty when target is next day after last', () => {
    const { days, totalCount } = listGapDaysBetween('2026-06-18', '2026-06-19');
    expect(days).toEqual([]);
    expect(totalCount).toBe(0);
  });
});

describe('findDuplicateShiftsForDate', () => {
  it('detects same shift on same day', () => {
    expect(findDuplicateShiftsForDate([{ status: 'active', shift: 'morning' }], ['morning', 'evening']))
      .toEqual(['morning']);
  });

  it('detects all vs morning conflict', () => {
    expect(findDuplicateShiftsForDate([{ status: 'active', shift: 'all' }], ['morning']))
      .toEqual(['morning']);
  });

  it('detects morning+evening vs all conflict', () => {
    expect(
      findDuplicateShiftsForDate(
        [{ status: 'active', shift: 'morning' }, { status: 'active', shift: 'evening' }],
        ['all'],
      ),
    ).toEqual(['all']);
  });

  it('ignores cancelled summaries', () => {
    expect(findDuplicateShiftsForDate([{ status: 'cancelled', shift: 'morning' }], ['morning']))
      .toEqual([]);
  });
});

describe('shiftConflictsWithDay', () => {
  it('all conflicts with any existing', () => {
    expect(shiftConflictsWithDay(['morning'], 'all')).toBe(true);
    expect(shiftConflictsWithDay(['all'], 'evening')).toBe(true);
  });
});

describe('isDayShiftCoverageComplete', () => {
  it('requires all or both shifts', () => {
    expect(isDayShiftCoverageComplete(['all'])).toBe(true);
    expect(isDayShiftCoverageComplete(['morning', 'evening'])).toBe(true);
    expect(isDayShiftCoverageComplete(['morning'])).toBe(false);
  });
});

describe('compareYmd', () => {
  it('orders YMD strings', () => {
    expect(compareYmd('2026-06-01', '2026-06-02')).toBeLessThan(0);
    expect(compareYmd('2026-06-02', '2026-06-01')).toBeGreaterThan(0);
  });
});

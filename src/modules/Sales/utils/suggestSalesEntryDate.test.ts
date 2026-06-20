import { describe, expect, it } from 'vitest';
import {
  compareYmd,
  findDuplicateShiftsForDate,
  listGapDaysBetween,
  suggestSalesEntryDate,
} from './suggestSalesEntryDate';

describe('suggestSalesEntryDate', () => {
  it('suggests today when no prior entry', () => {
    expect(suggestSalesEntryDate('2026-06-22', null)).toBe('2026-06-22');
  });

  it('suggests next day after last entry when behind', () => {
    expect(suggestSalesEntryDate('2026-06-22', '2026-06-18')).toBe('2026-06-19');
  });

  it('suggests today when last entry was yesterday', () => {
    expect(suggestSalesEntryDate('2026-06-22', '2026-06-21')).toBe('2026-06-22');
  });

  it('suggests today when last entry is today', () => {
    expect(suggestSalesEntryDate('2026-06-22', '2026-06-22')).toBe('2026-06-22');
  });
});

describe('listGapDaysBetween', () => {
  it('returns days between last entry and target', () => {
    expect(listGapDaysBetween('2026-06-18', '2026-06-22')).toEqual([
      '2026-06-19',
      '2026-06-20',
      '2026-06-21',
    ]);
  });

  it('returns empty when target is next day after last', () => {
    expect(listGapDaysBetween('2026-06-18', '2026-06-19')).toEqual([]);
  });
});

describe('findDuplicateShiftsForDate', () => {
  it('detects existing shift on same day', () => {
    const dupes = findDuplicateShiftsForDate(
      [{ status: 'active', shift: 'morning' }],
      ['morning', 'evening'],
    );
    expect(dupes).toEqual(['morning']);
  });

  it('ignores cancelled summaries', () => {
    const dupes = findDuplicateShiftsForDate(
      [{ status: 'cancelled', shift: 'morning' }],
      ['morning'],
    );
    expect(dupes).toEqual([]);
  });
});

describe('compareYmd', () => {
  it('orders YMD strings', () => {
    expect(compareYmd('2026-06-01', '2026-06-02')).toBeLessThan(0);
    expect(compareYmd('2026-06-02', '2026-06-01')).toBeGreaterThan(0);
  });
});

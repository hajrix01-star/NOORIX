import {
  hasCalendarTargetOverride,
  normalizeCalendarDayNotes,
  normalizeCalendarSpecialDays,
  normalizeCalendarTargets,
} from './dashboard-calendar-contracts';

describe('dashboard calendar contracts', () => {
  it('normalizes targets and ignores invalid days', () => {
    expect(normalizeCalendarTargets({
      overall: '1,200',
      byDow: { 0: '100', 6: 250, 7: 999, bad: 50 },
    })).toEqual({
      overall: 1200,
      byDow: { 0: 100, 6: 250 },
    });
  });

  it('detects real target overrides', () => {
    expect(hasCalendarTargetOverride(normalizeCalendarTargets({ overall: null, byDow: {} }))).toBe(false);
    expect(hasCalendarTargetOverride(normalizeCalendarTargets({ overall: 1, byDow: {} }))).toBe(true);
    expect(hasCalendarTargetOverride(normalizeCalendarTargets({ overall: null, byDow: { 1: 25 } }))).toBe(true);
  });

  it('normalizes special days and notes', () => {
    expect(normalizeCalendarSpecialDays([
      { id: 'sp-1', name: 'Season', fromDate: '2026-03-01', toDate: '2026-03-05' },
      { name: 'Missing id', fromDate: '2026-03-01', toDate: '2026-03-05' },
    ])).toEqual([
      { id: 'sp-1', name: 'Season', fromDate: '2026-03-01', toDate: '2026-03-05', color: '#8b5cf6' },
    ]);
    expect(normalizeCalendarDayNotes({ '2026-03-01': ' note ', empty: '' })).toEqual({
      '2026-03-01': 'note',
    });
  });
});

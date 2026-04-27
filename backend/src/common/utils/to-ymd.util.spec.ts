import { toYmd } from './to-ymd.util';

describe('toYmd', () => {
  it('returns empty string for nullish or empty', () => {
    expect(toYmd(null)).toBe('');
    expect(toYmd(undefined)).toBe('');
    expect(toYmd('')).toBe('');
  });

  it('trims and takes first 10 chars from string (ISO prefix)', () => {
    expect(toYmd('  2025-03-01T12:34:56.789Z  ')).toBe('2025-03-01');
    expect(toYmd('2025-03-01')).toBe('2025-03-01');
  });

  it('formats Date as UTC calendar day (ISO date part)', () => {
    expect(toYmd(new Date(Date.UTC(2024, 5, 15)))).toBe('2024-06-15');
  });

  it('returns empty string for invalid Date', () => {
    expect(toYmd(new Date(NaN))).toBe('');
  });
});

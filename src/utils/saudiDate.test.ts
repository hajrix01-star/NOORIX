import { describe, it, expect } from 'vitest';
import { toDateInputYmd, getSaudiToday, toYmd } from './saudiDate';

describe('toDateInputYmd', () => {
  it('returns empty for empty, null, and undefined', () => {
    expect(toDateInputYmd('')).toBe('');
    expect(toDateInputYmd(null)).toBe('');
    expect(toDateInputYmd(undefined)).toBe('');
  });

  it('returns empty for unparseable input', () => {
    expect(toDateInputYmd('not-a-date')).toBe('');
  });

  it('maps a UTC instant to the calendar day in Riyadh', () => {
    expect(toDateInputYmd('2020-01-15T00:00:00.000Z')).toBe('2020-01-15');
  });
});

describe('getSaudiToday', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(getSaudiToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('toYmd', () => {
  it('returns first 10 chars for ISO strings', () => {
    expect(toYmd('2024-03-05T12:00:00.000Z')).toBe('2024-03-05');
  });
  it('trims surrounding whitespace', () => {
    expect(toYmd('  2024-03-05T00:00:00Z  ')).toBe('2024-03-05');
  });
  it('returns empty for nullish', () => {
    expect(toYmd(null)).toBe('');
    expect(toYmd('')).toBe('');
  });

  it('formats Date as UTC calendar day (matches backend toYmd)', () => {
    expect(toYmd(new Date(Date.UTC(2024, 5, 15)))).toBe('2024-06-15');
  });

  it('returns empty for invalid Date', () => {
    expect(toYmd(new Date(NaN))).toBe('');
  });
});

import { describe, it, expect } from 'vitest';
import { toDateInputYmd, getSaudiToday } from './saudiDate';

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

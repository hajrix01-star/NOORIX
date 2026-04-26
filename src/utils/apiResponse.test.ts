import { describe, it, expect } from 'vitest';
import { assertApiOk, getApiErrorMessage, rejectIfApiFailed } from './apiResponse';

describe('getApiErrorMessage', () => {
  it('uses error then message then fallback', () => {
    expect(getApiErrorMessage({ error: 'E1' }, 'fb')).toBe('E1');
    expect(getApiErrorMessage({ message: 'M1' }, 'fb')).toBe('M1');
    expect(getApiErrorMessage({ success: false }, 'fb')).toBe('fb');
    expect(getApiErrorMessage(null, 'fb')).toBe('fb');
  });
});

describe('rejectIfApiFailed', () => {
  it('throws when success is false', () => {
    expect(() => rejectIfApiFailed({ success: false, error: 'X' }, 'fb')).toThrow('X');
    try {
      rejectIfApiFailed({ success: false, message: 'Y' });
    } catch (e: any) {
      expect(e.message).toBe('Y');
      expect(e.apiResult).toEqual({ success: false, message: 'Y' });
    }
  });

  it('does not throw when success is true or success key missing', () => {
    expect(() => rejectIfApiFailed({ success: true })).not.toThrow();
    expect(() => rejectIfApiFailed({ data: 1 })).not.toThrow();
    expect(() => rejectIfApiFailed(null)).not.toThrow();
  });
});

describe('assertApiOk', () => {
  it('throws like rejectIfApiFailed when success is false', () => {
    expect(() => assertApiOk({ success: false, error: 'Z' }, 'fb')).toThrow('Z');
  });

  it('uses fallback when API omits error text', () => {
    expect(() => assertApiOk({ success: false }, 'custom-fallback')).toThrow('custom-fallback');
  });

  it('returns the result when ok or success key missing', () => {
    const ok = { success: true, data: 42 };
    expect(assertApiOk(ok, 'fb')).toBe(ok);
    const raw = { id: 1 };
    expect(assertApiOk(raw, 'fb')).toBe(raw);
  });
});

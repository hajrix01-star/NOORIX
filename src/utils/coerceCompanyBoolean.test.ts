import { describe, it, expect } from 'vitest';
import { coerceCompanyBoolean } from './coerceCompanyBoolean';

describe('coerceCompanyBoolean', () => {
  it('handles boolean', () => {
    expect(coerceCompanyBoolean(true)).toBe(true);
    expect(coerceCompanyBoolean(false)).toBe(false);
  });

  it('does not treat string "false" as true', () => {
    expect(coerceCompanyBoolean('false')).toBe(false);
    expect(coerceCompanyBoolean('true')).toBe(true);
  });

  it('uses fallback for unknown values', () => {
    expect(coerceCompanyBoolean(undefined, true)).toBe(true);
    expect(coerceCompanyBoolean(null, false)).toBe(false);
  });
});

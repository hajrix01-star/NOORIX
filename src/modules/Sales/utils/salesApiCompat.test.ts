import { describe, it, expect } from 'vitest';
import { isShiftPropertyRejected } from './salesApiCompat';

describe('isShiftPropertyRejected', () => {
  it('detects forbidNonWhitelisted shift', () => {
    expect(isShiftPropertyRejected('property shift should not exist')).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isShiftPropertyRejected('يجب إدخال قناة بيع واحدة على الأقل')).toBe(false);
  });
});

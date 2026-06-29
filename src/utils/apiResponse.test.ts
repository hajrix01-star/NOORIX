import { describe, it, expect } from 'vitest';
import { getApiErrorMessage } from './apiResponse';

describe('getApiErrorMessage', () => {
  it('uses error then message then fallback', () => {
    expect(getApiErrorMessage({ error: 'E1' }, 'fb')).toBe('E1');
    expect(getApiErrorMessage({ message: 'M1' }, 'fb')).toBe('M1');
    expect(getApiErrorMessage({ success: false }, 'fb')).toBe('fb');
    expect(getApiErrorMessage(null, 'fb')).toBe('fb');
  });
});

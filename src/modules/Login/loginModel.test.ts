import { describe, expect, it } from 'vitest';
import { resolveLoginIdentifier, loginErrorMessage } from './loginModel';

describe('loginModel', () => {
  it('normalizes full email identifiers', () => {
    expect(resolveLoginIdentifier('  USER@Example.COM ')).toBe('user@example.com');
  });

  it('expands username identifiers to the configured official domain', () => {
    expect(resolveLoginIdentifier('  owner ')).toContain('owner@');
  });

  it('keeps unknown thrown values behind the caller fallback', () => {
    expect(loginErrorMessage('bad', 'fallback')).toBe('fallback');
    expect(loginErrorMessage(new Error('network'), 'fallback')).toBe('network');
  });
});

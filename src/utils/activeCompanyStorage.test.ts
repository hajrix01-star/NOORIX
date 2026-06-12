import { describe, it, expect, beforeEach } from 'vitest';
import { STORAGE_KEYS } from '../constants/storageKeys';
import {
  lastCompanyStorageKey,
  readLastCompanyForUser,
  saveLastCompanyForUser,
  resolvePreferredCompanyId,
} from './activeCompanyStorage';

describe('activeCompanyStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('saves and reads per-user last company', () => {
    saveLastCompanyForUser('user-1', 'company-b');
    expect(readLastCompanyForUser('user-1')).toBe('company-b');
    expect(localStorage.getItem(STORAGE_KEYS.ACTIVE_COMPANY)).toBe('company-b');
    expect(readLastCompanyForUser('user-2')).toBe('');
  });

  it('resolvePreferredCompanyId prefers user last company when allowed', () => {
    saveLastCompanyForUser('u1', 'co-b');
    expect(resolvePreferredCompanyId('u1', ['co-a', 'co-b'])).toBe('co-b');
  });

  it('resolvePreferredCompanyId falls back to first allowed when last is invalid', () => {
    saveLastCompanyForUser('u1', 'co-removed');
    expect(resolvePreferredCompanyId('u1', ['co-a', 'co-b'])).toBe('co-a');
  });

  it('lastCompanyStorageKey is stable', () => {
    expect(lastCompanyStorageKey('abc')).toBe('noorix-last-company:abc');
  });
});

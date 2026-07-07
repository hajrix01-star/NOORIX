import { describe, it, expect } from 'vitest';
import {
  formatFileSize,
  scopeLabel,
  statusBadgeColor,
  defaultImportCompanyName,
} from './backupTabHelpers';

const t = (key: string) => key;

describe('backupTabHelpers', () => {
  it('formatFileSize handles common ranges', () => {
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(2048)).toMatch(/KB/);
    expect(formatFileSize(2 * 1024 * 1024)).toMatch(/MB/);
  });

  it('scopeLabel maps known scopes', () => {
    expect(scopeLabel('company_logical', t)).toBe('backupScopeCompany');
    expect(scopeLabel('unknown_scope', t)).toBe('unknown_scope');
  });

  it('statusBadgeColor returns a token', () => {
    expect(statusBadgeColor('completed')).toBe('green');
    expect(statusBadgeColor('xyz')).toBe('gray');
  });

  it('defaultImportCompanyName uses company and ordinal', () => {
    const name = defaultImportCompanyName(
      {
        company: { nameAr: 'شركة تجريبية' },
        completedAt: null,
        createdAt: '2024-01-15T10:00:00.000Z',
        ordinal: 3,
      },
      t,
      'ar',
    );
    expect(name).toContain('شركة تجريبية');
    expect(name).toContain('#3');
  });
});

import { describe, it, expect } from 'vitest';
import {
  BackupCommandCenter,
  BackupSheetsAndModals,
  BackupCountsGrid,
  formatBackupDate,
  formatFileSize,
  defaultImportCompanyName,
  scopeLabel,
  statusLabel,
  statusBadgeColor,
} from './index';

describe('backup module barrel', () => {
  it('re-exports section components as functions', () => {
    expect(typeof BackupCommandCenter).toBe('function');
    expect(typeof BackupSheetsAndModals).toBe('function');
    expect(typeof BackupCountsGrid).toBe('function');
  });

  it('re-exports helpers', () => {
    expect(typeof formatBackupDate).toBe('function');
    expect(typeof formatFileSize).toBe('function');
    expect(typeof defaultImportCompanyName).toBe('function');
    expect(typeof scopeLabel).toBe('function');
    expect(typeof statusLabel).toBe('function');
    expect(typeof statusBadgeColor).toBe('function');
  });

  it('formatFileSize behaves for known input', () => {
    expect(formatFileSize(2048)).toMatch(/2/);
  });
});

import { describe, expect, it } from 'vitest';
import type { BackupJob } from '../../settingsTypes';
import {
  backupRowScope,
  isCompletedBackup,
  isTrustedBackup,
  latestBackup,
  latestFailedBackup,
  latestTrustedBackup,
  scheduleText,
  uniqueUnifiedRows,
  verificationColor,
  verificationLabel,
} from './backupCommandCenterModel';

function job(overrides: Partial<BackupJob>): BackupJob {
  return {
    id: 'job-1',
    status: 'completed',
    scope: 'company_logical',
    createdAt: '2026-07-01T10:00:00.000Z',
    localRelativePath: 'backup.tar.gz',
    verifyOk: true,
    ...overrides,
  };
}

describe('backupCommandCenterModel', () => {
  const t = (key: string) => key;
  const label = (ar: string, en: string) => `${ar}/${en}`;

  it('detects completed and trusted backups only after a file and verification', () => {
    expect(isCompletedBackup(job({ localRelativePath: 'ok.tar.gz' }))).toBe(true);
    expect(isCompletedBackup(job({ localRelativePath: null }))).toBe(false);
    expect(isTrustedBackup(job({ verifyOk: true }))).toBe(true);
    expect(isTrustedBackup(job({ verifyOk: false }))).toBe(false);
  });

  it('formats schedule time with stable zero padding', () => {
    expect(scheduleText({ scheduleHour: 6, scheduleMinute: 0 })).toBe('06:00');
    expect(scheduleText({ scheduleHour: 23, scheduleMinute: 5 })).toBe('23:05');
  });

  it('labels verification states without leaking UI logic into the component', () => {
    expect(verificationLabel(job({ verifyOk: true }), t, label)).toBe('backupVerifyOk');
    expect(verificationLabel(job({ verifyOk: false }), t, label)).toBe('فشل الفحص/Verify failed');
    expect(verificationLabel(job({ verifyOk: null, status: 'completed' }), t, label)).toBe('لم يفحص/Not checked');
    expect(verificationLabel(job({ verifyOk: null, status: 'running' }), t, label)).toBe('-');

    expect(verificationColor(job({ verifyOk: true }))).toBe('green');
    expect(verificationColor(job({ verifyOk: false }))).toBe('red');
    expect(verificationColor(job({ verifyOk: null }))).toBe('gray');
  });

  it('classifies system and company rows from backup scope', () => {
    expect(backupRowScope(job({ scope: 'system_full' }))).toBe('system');
    expect(backupRowScope(job({ scope: 'database_full' }))).toBe('system');
    expect(backupRowScope(job({ scope: 'company_logical' }))).toBe('company');
  });

  it('merges system and company jobs by latest date and de-duplicates ids', () => {
    const rows = uniqueUnifiedRows(
      [
        job({ id: 'shared', scope: 'system_full', createdAt: '2026-07-03T10:00:00.000Z' }),
        job({ id: 'system-old', scope: 'system_full', createdAt: '2026-07-01T10:00:00.000Z' }),
      ],
      [
        job({ id: 'shared', scope: 'company_logical', createdAt: '2026-07-04T10:00:00.000Z' }),
        job({ id: 'company-new', scope: 'company_logical', createdAt: '2026-07-05T10:00:00.000Z' }),
      ],
    );

    expect(rows.map((row) => row.id)).toEqual(['company-new', 'shared', 'system-old']);
    expect(rows.map((row) => row.rowScope)).toEqual(['company', 'company', 'system']);
  });

  it('resolves latest backup summaries centrally', () => {
    const jobs = [
      job({ id: 'old', createdAt: '2026-07-01T10:00:00.000Z', verifyOk: true }),
      job({ id: 'failed', createdAt: '2026-07-03T10:00:00.000Z', status: 'failed', verifyOk: null }),
      job({ id: 'latest', createdAt: '2026-07-04T10:00:00.000Z', verifyOk: false }),
    ];

    expect(latestBackup(jobs)?.id).toBe('latest');
    expect(latestTrustedBackup(jobs)?.id).toBe('old');
    expect(latestFailedBackup(jobs)?.id).toBe('latest');
  });
});


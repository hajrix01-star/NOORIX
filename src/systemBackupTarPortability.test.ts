import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const backupArchiveFiles = [
  'backend/src/backup/backup-system-full-parity-verify.util.ts',
  'backend/src/backup/backup-system-full-restore.util.ts',
];

describe('system backup tar portability', () => {
  it('avoids GNU-only tar extraction flags in archive verification and restore paths', () => {
    const offenders = backupArchiveFiles.filter((file) => {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      return source.includes('--no-absolute-names');
    });

    expect(offenders).toEqual([]);
  });
});

import { ForbiddenException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { getBackupRoot } from './backup-env-paths.util';

export async function readGzippedJsonFromAbsPath(absPath: string): Promise<Record<string, unknown>> {
  const buf = await fs.readFile(absPath);
  const json = zlib.gunzipSync(buf).toString('utf8');
  return JSON.parse(json) as Record<string, unknown>;
}

export async function readGzippedJsonByBackupRelativePath(localRelativePath: string): Promise<Record<string, unknown>> {
  return readGzippedJsonFromAbsPath(path.join(getBackupRoot(), localRelativePath));
}

export function assertSnapshotBelongsToTenant(parsed: Record<string, unknown>, tenantId: string): void {
  const meta = parsed.meta as { tenantId?: string } | undefined;
  if (meta?.tenantId && meta.tenantId !== tenantId) {
    throw new ForbiddenException('اللقطة لا تخص مستأجرك');
  }
}

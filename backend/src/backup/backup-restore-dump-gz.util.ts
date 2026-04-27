import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as zlib from 'zlib';
import { pgRestoreCustomFormatFile } from './backup-system-full-restore.util';

/**
 * استعادة نسخة `database_full` من ملف .dump.gz (pg_dump custom + gzip).
 */
export async function restoreDatabaseFullFromGzippedCustomDump(absGzPath: string): Promise<void> {
  const tmp = path.join(os.tmpdir(), `noorix-restore-${Date.now()}-${Math.random().toString(36).slice(2)}.dump`);
  try {
    const buf = await fs.readFile(absGzPath);
    const unz = zlib.gunzipSync(buf);
    await fs.writeFile(tmp, unz);
  } catch (e) {
    throw new BadRequestException(`تعذّر فك ملف النسخة: ${(e as Error).message}`);
  }
  try {
    await pgRestoreCustomFormatFile(tmp);
  } finally {
    await fs.unlink(tmp).catch(() => undefined);
  }
}

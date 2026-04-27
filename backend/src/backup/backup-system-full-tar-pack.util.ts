import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { UPLOADS_ROOT } from '../common/uploads-root';
import { runPgDumpToFile } from './backup-pg-dump.util';

/**
 * إنشاء أرشيف نظام كامل (pg_dump + uploads) تحت `root` في `system/…tar.gz`
 * وإرجاع مسارات الملف النهائي وحالة المرفوعات.
 * يحذف المجلد المؤقت دائماً عبر `finally`.
 */
export async function packSystemFullArchiveToDisk(params: {
  root: string;
  baseName: string;
}): Promise<{ finalAbs: string; finalRel: string; hasUploads: boolean }> {
  const { root, baseName } = params;
  const finalRel = path.join('system', `${baseName}.tar.gz`);
  const finalAbs = path.join(root, finalRel);
  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'noorix-sysfull-'));
  const dumpPath = path.join(tmpBase, 'db.dump');

  try {
    await fs.mkdir(path.dirname(finalAbs), { recursive: true });
    await runPgDumpToFile(dumpPath);

    const uploadsPath = UPLOADS_ROOT;
    const cwd = process.cwd();
    let hasUploads = false;
    try {
      const st = await fs.stat(uploadsPath);
      hasUploads = st.isDirectory();
    } catch {
      hasUploads = false;
    }

    const tarArgs = ['-czf', finalAbs, '-C', tmpBase, 'db.dump'];
    if (hasUploads) {
      tarArgs.push('-C', cwd, 'uploads');
    }

    await new Promise<void>((resolve, reject) => {
      const child = spawn('tar', tarArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
      let err = '';
      child.stderr?.on('data', (c) => {
        err += String(c);
      });
      child.on('error', (e) => reject(new BadRequestException(`تعذّر تشغيل tar: ${(e as Error).message}`)));
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new BadRequestException(`فشل ضغط أرشيف النظام: ${err || 'رمز ' + code}`));
      });
    });

    return { finalAbs, finalRel, hasUploads };
  } finally {
    await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => undefined);
  }
}

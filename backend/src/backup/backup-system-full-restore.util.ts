import { BadRequestException } from '@nestjs/common';
import { Client } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { parseDatabaseUrl } from './backup-database-url.util';
import { UPLOADS_ROOT } from '../common/uploads-root';

/** تحقق سريع من أرشيف tar.gz (قائمة أولية) */
export function verifySystemFullTarGz(abs: string): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn('tar', ['-tzf', abs], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout?.on('data', (c) => {
      out += String(c);
    });
    child.stderr?.on('data', (c) => {
      err += String(c);
    });
    child.on('error', (e) => resolve({ ok: false, error: (e as Error).message }));
    child.on('close', (code) => {
      if (code !== 0) {
        resolve({ ok: false, error: err || `رمز ${code}` });
        return;
      }
      const lines = out.split('\n').filter(Boolean);
      const hasDump = lines.some((l) => l === 'db.dump' || l.endsWith('/db.dump'));
      if (!hasDump) {
        resolve({ ok: false, error: 'الأرشيف لا يحتوي db.dump' });
        return;
      }
      resolve({ ok: true });
    });
  });
}

export async function extractTarGzArchiveToDir(archiveAbs: string, destDir: string): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', ['-xzf', archiveAbs, '-C', destDir], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr?.on('data', (c) => {
      err += String(c);
    });
    child.on('error', (e) => reject(new BadRequestException(`تعذّر فك الأرشيف: ${(e as Error).message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new BadRequestException(`فشل فك الأرشيف: ${err || 'رمز ' + code}`));
    });
  });
}

/** pg_restore لملف dump بصيغة custom (ملف db.dump دون gzip) */
export async function pgRestoreCustomFormatFile(dumpPath: string): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new BadRequestException('DATABASE_URL غير مُعرّف');
  const { host, port, user, password, database } = parseDatabaseUrl(dbUrl.split('?')[0]);
  const adminUrl = dbUrl.replace(/\/([^/?]+)(\?|$)/, '/postgres$2');
  const adminClient = new Client({ connectionString: adminUrl });
  await adminClient.connect();
  try {
    await adminClient.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [database],
    );
  } finally {
    await adminClient.end().catch(() => undefined);
  }

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'pg_restore',
      ['--clean', '--if-exists', '--no-owner', '--no-acl', '-h', host, '-p', port, '-U', user, '-d', database, dumpPath],
      {
        env: {
          ...process.env,
          PGPASSWORD: password,
          PGSSLMODE: host === 'localhost' || host === '127.0.0.1' ? 'disable' : 'require',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let err = '';
    child.stderr?.on('data', (c) => {
      err += String(c);
    });
    child.on('error', (e) => reject(new BadRequestException(`تعذّر تشغيل pg_restore: ${(e as Error).message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new BadRequestException(`فشل pg_restore: ${err || 'رمز ' + code}`));
    });
  });
}

/**
 * فك أرشيف نظام كامل وتشغيل pg_restore ودمج مجلد uploads تحت cwd للباكند.
 */
export async function applySystemFullTarRestore(archiveAbs: string): Promise<void> {
  const v = await verifySystemFullTarGz(archiveAbs);
  if (!v.ok) throw new BadRequestException(v.error || 'ملف الأرشيف غير صالح');

  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'noorix-restore-sysfull-'));
  try {
    await extractTarGzArchiveToDir(archiveAbs, tmpBase);
    const dumpPath = path.join(tmpBase, 'db.dump');
    try {
      await fs.access(dumpPath);
    } catch {
      throw new BadRequestException('بعد فك الأرشيف لم يُعثر على db.dump');
    }
    await pgRestoreCustomFormatFile(dumpPath);

    const uploadsSrc = path.join(tmpBase, 'uploads');
    let hasUploads = false;
    try {
      const st = await fs.stat(uploadsSrc);
      hasUploads = st.isDirectory();
    } catch {
      hasUploads = false;
    }
    if (hasUploads) {
      const destUploads = UPLOADS_ROOT;
      await fs.mkdir(destUploads, { recursive: true });
      await fs.cp(uploadsSrc, destUploads, { recursive: true });
    }
  } finally {
    await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => undefined);
  }
}

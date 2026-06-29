import { BadRequestException } from '@nestjs/common';
import { spawn } from 'child_process';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { parseDatabaseUrl } from './backup-database-url.util';

export async function runPgDumpToFile(outPath: string): Promise<void> {
  const dbUrl = process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) throw new BadRequestException('DATABASE_URL غير معرف');
  const { host, port, user, password, database } = parseDatabaseUrl(dbUrl.split('?')[0]);

  const primary = await tryPgDump(
    'pg_dump',
    ['-h', host, '-p', port, '-U', user, '-d', database, '--no-owner', '--no-acl', '--format=custom', '-f', outPath],
    {
      ...process.env,
      PGPASSWORD: password,
      PGSSLMODE: host === 'localhost' || host === '127.0.0.1' ? 'disable' : 'require',
    },
  );
  if (primary.ok) return;

  if (isLocalHost(host)) {
    const postgresOutPath = path.join(os.tmpdir(), `noorix-pg-dump-postgres-${process.pid}-${randomUUID()}.dump`);
    const localPostgres = await tryPgDump(
      'runuser',
      [
        '-u',
        'postgres',
        '--',
        'pg_dump',
        '-p',
        port,
        '-d',
        database,
        '--no-owner',
        '--no-acl',
        '--format=custom',
        '-f',
        postgresOutPath,
      ],
      { ...process.env, PGSSLMODE: 'disable' },
    );
    if (localPostgres.ok) {
      try {
        await fs.copyFile(postgresOutPath, outPath);
      } finally {
        await fs.unlink(postgresOutPath).catch(() => undefined);
      }
      return;
    }

    throw new BadRequestException(
      `فشل pg_dump بمستخدم التطبيق: ${formatPgDumpError(primary.error)}\nفشل fallback المحلي عبر postgres: ${localPostgres.error}`,
    );
  }

  throw new BadRequestException(`فشل pg_dump: ${formatPgDumpError(primary.error)}`);
}

function formatPgDumpError(raw: string): string {
  const msg = raw.trim();
  if (isRowSecurityError(msg)) {
    return [
      msg,
      'سبب الفشل: مستخدم قاعدة البيانات المستخدم في النسخ لا يستطيع تجاوز RLS.',
      'الحل: عين BACKUP_DATABASE_URL بمستخدم PostgreSQL مخصص للنسخ الكامل مثل postgres أو role لديه BYPASSRLS.',
    ].join('\n');
  }
  return msg;
}

async function tryPgDump(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
): Promise<{ ok: true } | { ok: false; error: string }> {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let err = '';
    child.stderr?.on('data', (c) => {
      err += String(c);
    });
    child.on('error', (e) => resolve({ ok: false, error: `تعذر تشغيل ${command}: ${(e as Error).message}` }));
    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true });
      else resolve({ ok: false, error: (err || `رمز ${code}`).trim() });
    });
  });
}

function isRowSecurityError(msg: string): boolean {
  return /row-level security|RLS|would be affected by row-level security/i.test(msg);
}

function isLocalHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1';
}

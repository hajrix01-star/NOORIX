import { BadRequestException } from '@nestjs/common';
import { spawn } from 'child_process';
import { parseDatabaseUrl } from './backup-database-url.util';

export async function runPgDumpToFile(outPath: string): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new BadRequestException('DATABASE_URL غير مُعرّف');
  const { host, port, user, password, database } = parseDatabaseUrl(dbUrl.split('?')[0]);

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'pg_dump',
      ['-h', host, '-p', port, '-U', user, '-d', database, '--no-owner', '--no-acl', '--format=custom', '-f', outPath],
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
    child.on('error', (e) => reject(new BadRequestException(`تعذّر تشغيل pg_dump: ${(e as Error).message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new BadRequestException(`فشل pg_dump: ${err || 'رمز ' + code}`));
    });
  });
}

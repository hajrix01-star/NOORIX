import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { spawn } from 'child_process';

const gzipAsync = promisify(zlib.gzip);

export async function sha256File(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const s = fsSync.createReadStream(filePath);
    s.on('data', (c) => hash.update(c));
    s.on('end', () => resolve());
    s.on('error', reject);
  });
  return hash.digest('hex');
}

export async function gzipFile(src: string, dest: string): Promise<void> {
  const buf = await fs.readFile(src);
  const zipped = await gzipAsync(buf, { level: 9 });
  await fs.writeFile(dest, zipped);
  await fs.unlink(src).catch(() => undefined);
}

export async function verifyPgCustomDumpGz(absGzPath: string): Promise<{ ok: boolean; error?: string }> {
  const tmp = path.join(os.tmpdir(), `noorix-pgverify-${Date.now()}-${Math.random().toString(36).slice(2)}.dump`);
  try {
    const buf = await fs.readFile(absGzPath);
    const unz = zlib.gunzipSync(buf);
    await fs.writeFile(tmp, unz);
    await new Promise<void>((resolve, reject) => {
      const child = spawn('pg_restore', ['-l', tmp], { stdio: ['ignore', 'pipe', 'pipe'] });
      let err = '';
      child.stderr?.on('data', (c) => {
        err += String(c);
      });
      child.on('error', (e) => reject(new Error(`تعذّر تشغيل pg_restore: ${(e as Error).message}`)));
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(err || `pg_restore رمز ${code}`));
      });
    });
    await fs.unlink(tmp).catch(() => undefined);
    return { ok: true };
  } catch (e) {
    await fs.unlink(tmp).catch(() => undefined);
    return { ok: false, error: (e as Error).message };
  }
}

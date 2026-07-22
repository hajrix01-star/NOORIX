import { BadRequestException } from '@nestjs/common';
import { Client } from 'pg';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';
import { parseDatabaseUrl } from './backup-database-url.util';
import { UPLOADS_ROOT } from '../common/uploads-root';

const TAR_MODE_RE = /^[dlbhcp-][rwxstST-]{9}$/;

/** تطبيع اسم عضو من قائمة tar -tzf (للمقارنة والتحقق) */
export function normalizeTarListEntry(raw: string): string {
  let s = String(raw).trim().replace(/\\/g, '/');
  while (s.startsWith('./')) s = s.slice(2);
  s = s.replace(/\/+/g, '/');
  if (s.endsWith('/') && s.length > 1) s = s.slice(0, -1);
  return s;
}

/** رفض .. والمسارات المطلقة وأحرف الأقراص وغيرها */
export function assertSafeTarEntryName(raw: string): void {
  const s0 = String(raw).trim();
  if (!s0 || s0.includes('\0')) {
    throw new BadRequestException('اسم غير صالح في الأرشيف');
  }
  const s = normalizeTarListEntry(raw);
  if (path.posix.isAbsolute(s) || s.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(s)) {
    throw new BadRequestException('مسار مطلق أو غير مسموح في الأرشيف');
  }
  const parts = s.split('/').filter(Boolean);
  for (const p of parts) {
    if (p === '.' || p === '..') {
      throw new BadRequestException('مسار يحتوي .. أو . — مرفوض');
    }
  }
}

/** يُسمح فقط بـ db.dump و uploads/** */
export function assertAllowedRestoreMember(norm: string): void {
  assertSafeTarEntryName(norm);
  if (norm === 'db.dump') return;
  if (norm === 'uploads' || norm.startsWith('uploads/')) return;
  throw new BadRequestException(`عضو غير مسموح في أرشيف الاستعادة: ${norm}`);
}

/**
 * يفحص جميع أسماء الأعضاء قبل أي فك — يرفض أي مسار خارج القائمة البيضاء.
 * @returns الأسماء كما في الأرشيف (لـ --files-from) بعد التحقق
 */
export function validateRestoreArchiveEntries(memberLines: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of memberLines) {
    const trimmed = String(raw).trim();
    if (!trimmed) continue;
    const norm = normalizeTarListEntry(trimmed);
    if (norm.startsWith('PaxHeader/') || norm.startsWith('GNUMessage/')) {
      throw new BadRequestException('أرشيف يحتوي رؤوس Pax/امتداد — غير مدعوم لاستعادة النظام');
    }
    assertAllowedRestoreMember(norm);
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
  }
  if (!out.some((l) => normalizeTarListEntry(l) === 'db.dump')) {
    throw new BadRequestException('الأرشيف لا يحتوي db.dump');
  }
  return out;
}

function spawnTarCollectStdout(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout?.on('data', (c) => {
      out += String(c);
    });
    child.stderr?.on('data', (c) => {
      err += String(c);
    });
    child.on('error', (e) => reject(new BadRequestException(`تعذّر تشغيل tar: ${(e as Error).message}`)));
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new BadRequestException(`فشل tar (${args[1]}): ${err || 'رمز ' + code}`));
        return;
      }
      resolve(out);
    });
  });
}

export async function listTarGzMemberNames(archiveAbs: string): Promise<string[]> {
  const out = await spawnTarCollectStdout(['-tzf', archiveAbs]);
  return out.split(/\r?\n/).filter((l) => l.trim().length > 0);
}

/**
 * tar -tvzf: رفض symlink و hardlink وأي نوع غير ملف/مجلد عادي.
 */
export async function assertTarGzNoSymlinksOrSpecialEntries(archiveAbs: string): Promise<void> {
  const out = await spawnTarCollectStdout(['-tvzf', archiveAbs]);
  const lines = out.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.includes(' -> ')) {
      throw new BadRequestException('الأرشيف يحتوي symlink — مرفوض لأسباب أمنية');
    }
    const tokens = t.split(/\s+/);
    const modeTok = tokens.find((tok) => TAR_MODE_RE.test(tok));
    if (!modeTok) continue;
    const typeChar = modeTok[0];
    if (typeChar === 'l' || typeChar === 'h') {
      throw new BadRequestException('الأرشيف يحتوي symlink أو hardlink — مرفوض');
    }
    if (typeChar !== '-' && typeChar !== 'd') {
      throw new BadRequestException('الأرشيف يحتوي نوع ملف غير مسموح (أجهزة/أنابيب/…) — مرفوض');
    }
  }
}

async function extractTarMembersWithFilesFrom(
  archiveAbs: string,
  destDir: string,
  members: readonly string[],
): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  const listPath = path.join(
    os.tmpdir(),
    `noorix-restore-members-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.txt`,
  );
  await fs.writeFile(listPath, [...members].join('\n'), 'utf8');
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'tar',
        ['-xzf', archiveAbs, '-C', destDir, '--files-from', listPath],
        { stdio: ['ignore', 'pipe', 'pipe'] },
      );
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
  } finally {
    await fs.unlink(listPath).catch(() => undefined);
  }
}

/** فك عضو واحد (احتياطي إذا رفض tar --files-from) */
async function extractSingleMember(archiveAbs: string, destDir: string, member: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', ['-xzf', archiveAbs, '-C', destDir, member], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let err = '';
    child.stderr?.on('data', (c) => {
      err += String(c);
    });
    child.on('error', (e) => reject(new BadRequestException(`تعذّر فك الأرشيف: ${(e as Error).message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new BadRequestException(`فشل فك عضو: ${member}: ${err || 'رمز ' + code}`));
    });
  });
}

async function extractTarMembersFallback(archiveAbs: string, destDir: string, members: readonly string[]): Promise<void> {
  await fs.mkdir(destDir, { recursive: true });
  for (const m of members) {
    await extractSingleMember(archiveAbs, destDir, m);
  }
}

/** يتأكد أن كل ملف/مجلد تحت الجذر يبقى داخل الجذر بعد realpath */
export async function assertExtractedTreeContainedIn(rootDir: string): Promise<void> {
  let rootReal: string;
  try {
    rootReal = await fs.realpath(rootDir);
  } catch {
    throw new BadRequestException('تعذّر حل مسار مجلد الاستعادة');
  }
  async function walk(current: string): Promise<void> {
    let names: string[];
    try {
      names = await fs.readdir(current);
    } catch {
      return;
    }
    for (const name of names) {
      const joined = path.join(current, name);
      const lst = await fs.lstat(joined).catch(() => null);
      if (!lst) continue;
      if (lst.isSymbolicLink()) {
        throw new BadRequestException('رابط رمزي داخل أرشيف الاستعادة — مرفوض');
      }
      let rp: string;
      try {
        rp = await fs.realpath(joined);
      } catch {
        rp = path.resolve(joined);
      }
      if (rp !== rootReal && !rp.startsWith(rootReal + path.sep)) {
        throw new BadRequestException('نتيجة فك الأرشيف خارج المجلد المؤقت — مرفوض');
      }
      if (lst.isDirectory()) await walk(joined);
    }
  }
  await walk(rootDir);
}

async function validateAndListRestoreMembers(archiveAbs: string): Promise<string[]> {
  const names = await listTarGzMemberNames(archiveAbs);
  await assertTarGzNoSymlinksOrSpecialEntries(archiveAbs);
  return validateRestoreArchiveEntries(names);
}

async function verifyPgCustomDumpFile(dumpPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('pg_restore', ['-l', dumpPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr?.on('data', (c) => {
      err += String(c);
    });
    child.on('error', (e) => reject(new BadRequestException(`Unable to run pg_restore: ${(e as Error).message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new BadRequestException(`db.dump verification failed: ${err || 'exit code ' + code}`));
    });
  });
}

async function verifySystemFullTarGzOrThrow(abs: string): Promise<void> {
  const members = await validateAndListRestoreMembers(abs);
  const dbDumpMember = members.find((member) => normalizeTarListEntry(member) === 'db.dump');
  if (!dbDumpMember) {
    throw new BadRequestException('Archive does not contain db.dump');
  }

  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'noorix-verify-sysfull-'));
  try {
    await extractSingleMember(abs, tmpBase, dbDumpMember);
    await assertExtractedTreeContainedIn(tmpBase);
    await verifyPgCustomDumpFile(path.join(tmpBase, 'db.dump'));
  } finally {
    await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function verifySystemFullTarGz(abs: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await verifySystemFullTarGzOrThrow(abs);
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof BadRequestException ? e.message : (e as Error).message,
    };
  }
}

/**
 * فك أرشيف tar.gz إلى مجلد بعد التحقق من كل العضويات — لا يُنفَّذ فك كامل بدون فحص مسبق.
 * @deprecated للاستعادة الكاملة يُفضّل استدعاء الدالة من applySystemFullTarRestore فقط؛ تُبقى للتوافق.
 */
export async function extractTarGzArchiveToDir(archiveAbs: string, destDir: string): Promise<void> {
  const members = await validateAndListRestoreMembers(archiveAbs);
  try {
    await extractTarMembersWithFilesFrom(archiveAbs, destDir, members);
  } catch (firstErr) {
    await fs.rm(destDir, { recursive: true, force: true }).catch(() => undefined);
    await fs.mkdir(destDir, { recursive: true });
    try {
      await extractTarMembersFallback(archiveAbs, destDir, members);
    } catch {
      throw firstErr;
    }
  }
  await assertExtractedTreeContainedIn(destDir);
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
  const members = await validateAndListRestoreMembers(archiveAbs);
  if (!members.length) throw new BadRequestException('أرشيف فارغ');

  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'noorix-restore-sysfull-'));
  try {
    try {
      await extractTarMembersWithFilesFrom(archiveAbs, tmpBase, members);
    } catch (firstErr) {
      await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => undefined);
      await fs.mkdir(tmpBase, { recursive: true });
      try {
        await extractTarMembersFallback(archiveAbs, tmpBase, members);
      } catch {
        throw firstErr;
      }
    }
    await assertExtractedTreeContainedIn(tmpBase);

    const dumpPath = path.join(tmpBase, 'db.dump');
    try {
      await fs.access(dumpPath);
    } catch {
      throw new BadRequestException('بعد فك الأرشيف لم يُعثر على db.dump');
    }
    const dumpReal = await fs.realpath(dumpPath).catch(() => path.resolve(dumpPath));
    const baseReal = await fs.realpath(tmpBase);
    if (dumpReal !== baseReal && !dumpReal.startsWith(baseReal + path.sep)) {
      throw new BadRequestException('مسار db.dump غير صالح بعد الفك');
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

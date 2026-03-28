import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { spawn } from 'child_process';
import { buildCompanyLogicalSnapshot } from './backup-company-export';

const gzipAsync = promisify(zlib.gzip);

const MAX_EXTERNAL_UPLOAD_BYTES = 18 * 1024 * 1024; // تجنّب تعطّل الذاكرة مع Apps Script الحالي

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getBackupRoot(): string {
    const raw = process.env.BACKUP_LOCAL_DIR || path.join(process.cwd(), 'data', 'backups');
    return path.resolve(raw);
  }

  private async ensureBackupRoot(): Promise<void> {
    const root = this.getBackupRoot();
    await fs.mkdir(root, { recursive: true });
  }

  private async sha256File(filePath: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    await new Promise<void>((resolve, reject) => {
      const s = fsSync.createReadStream(filePath);
      s.on('data', (c) => hash.update(c));
      s.on('end', () => resolve());
      s.on('error', reject);
    });
    return hash.digest('hex');
  }

  private parseDatabaseUrl(dbUrl: string): { host: string; port: string; user: string; password: string; database: string } {
    let u: URL;
    try {
      u = new URL(dbUrl.replace(/^postgresql:/i, 'http:'));
    } catch {
      throw new BadRequestException('DATABASE_URL غير صالح');
    }
    const database = (u.pathname || '/postgres').replace(/^\//, '').split('?')[0] || 'postgres';
    return {
      host: u.hostname,
      port: u.port || '5432',
      user: decodeURIComponent(u.username || 'postgres'),
      password: decodeURIComponent(u.password || ''),
      database,
    };
  }

  private async runPgDumpToFile(outPath: string): Promise<void> {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new BadRequestException('DATABASE_URL غير مُعرّف');
    const { host, port, user, password, database } = this.parseDatabaseUrl(dbUrl.split('?')[0]);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        'pg_dump',
        ['-h', host, '-p', port, '-U', user, '-d', database, '--no-owner', '--no-acl', '--format=custom', '-f', outPath],
        {
          env: { ...process.env, PGPASSWORD: password, PGSSLMODE: 'require' },
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

  private async gzipFile(src: string, dest: string): Promise<void> {
    const buf = await fs.readFile(src);
    const zipped = await gzipAsync(buf, { level: 9 });
    await fs.writeFile(dest, zipped);
    await fs.unlink(src).catch(() => undefined);
  }

  private async findDuplicateJob(
    tenantId: string | null,
    companyId: string | null,
    scope: string,
    hash: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.backupJob.findFirst({
      where: {
        scope,
        status: { in: ['completed', 'skipped_duplicate'] },
        contentHash: hash,
        ...(tenantId != null ? { tenantId } : { tenantId: null }),
        ...(companyId != null ? { companyId } : { companyId: null }),
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
  }

  async uploadToExternalIfConfigured(
    absPath: string,
    filename: string,
    meta: { company?: string; scope: string },
  ): Promise<{ ok: boolean; error?: string }> {
    const scriptUrl = process.env.BACKUP_GDRIVE_SCRIPT_URL || process.env.GDRIVE_SCRIPT_URL;
    if (!scriptUrl) return { ok: false, error: 'لا يوجد رابط تخزين خارجي (BACKUP_GDRIVE_SCRIPT_URL)' };

    const st = await fs.stat(absPath);
    if (st.size > MAX_EXTERNAL_UPLOAD_BYTES) {
      return {
        ok: false,
        error: `الملف أكبر من ${MAX_EXTERNAL_UPLOAD_BYTES >> 20} ميجابايت — ارفع يدوياً أو زد الحد لاحقاً`,
      };
    }

    const content_b64 = (await fs.readFile(absPath)).toString('base64');
    const payload = JSON.stringify({
      filename,
      content: content_b64,
      company: meta.company || 'noorix',
      scope: meta.scope,
    });

    try {
      const res = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        signal: AbortSignal.timeout(120_000),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; saved?: string };
      if (json?.ok) return { ok: true };
      return { ok: false, error: json?.error || res.statusText };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  async triggerCompanyLogicalBackup(params: {
    tenantId: string;
    userId: string;
    companyId: string;
    allowedCompanyIds: string[] | undefined;
  }): Promise<{ jobId: string }> {
    const { tenantId, userId, companyId, allowedCompanyIds } = params;
    if (allowedCompanyIds && !allowedCompanyIds.includes(companyId)) {
      throw new ForbiddenException('لا يمكنك نسخ هذه الشركة');
    }
    const co = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId },
      select: { id: true, nameAr: true },
    });
    if (!co) throw new NotFoundException('الشركة غير موجودة');

    await this.ensureBackupRoot();
    const job = await this.prisma.backupJob.create({
      data: {
        tenantId,
        companyId,
        scope: 'company_logical',
        status: 'running',
        createdByUserId: userId,
      },
    });

    const t0 = Date.now();
    const root = this.getBackupRoot();
    const rel = path.join('tenant', tenantId, 'company', `${companyId}_${job.id}.json.gz`);
    const abs = path.join(root, rel);

    try {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      const snapshot = await buildCompanyLogicalSnapshot(this.prisma, companyId);
      const json = JSON.stringify(snapshot, (_, v) => {
        if (v != null && typeof v === 'object' && v.constructor?.name === 'Decimal') return String(v);
        return v;
      });
      const zipped = await gzipAsync(Buffer.from(json, 'utf8'), { level: 9 });
      await fs.writeFile(abs, zipped);

      const hash = crypto.createHash('sha256').update(zipped).digest('hex');
      const dup = await this.findDuplicateJob(tenantId, companyId, 'company_logical', hash);
      if (dup && dup.id !== job.id) {
        await fs.unlink(abs).catch(() => undefined);
        await this.prisma.backupJob.update({
          where: { id: job.id },
          data: {
            status: 'skipped_duplicate',
            contentHash: hash,
            duplicateOfJobId: dup.id,
            durationMs: Date.now() - t0,
            completedAt: new Date(),
            report: {
              messageAr: 'نفس محتوى نسخة سابقة — لم يُحفظ ملف مكرّر',
              messageEn: 'Same content as a previous backup — duplicate skipped',
              counts: snapshot.counts,
            },
          },
        });
        return { jobId: job.id };
      }

      const st = await fs.stat(abs);
      let externalUploaded = false;
      let externalError: string | null = null;
      const up = await this.uploadToExternalIfConfigured(abs, path.basename(rel), {
        scope: 'company_logical',
        company: co.nameAr || companyId,
      });
      if (up.ok) externalUploaded = true;
      else externalError = up.error || null;

      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          contentHash: hash,
          localRelativePath: rel,
          sizeBytes: st.size,
          durationMs: Date.now() - t0,
          completedAt: new Date(),
          externalUploaded,
          externalError,
          report: {
            counts: snapshot.counts,
            resumeHintAr: externalError
              ? 'يمكنك لاحقاً استخدام «إعادة رفع خارجي» لاستكمال التخزين السحابي'
              : undefined,
          },
        },
      });
      return { jobId: job.id };
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.error(`Company backup failed: ${msg}`);
      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: msg,
          durationMs: Date.now() - t0,
          completedAt: new Date(),
        },
      });
      throw e;
    }
  }

  /** نسخة كاملة للقاعدة — للجدولة على الخادم فقط (tenantId = null) */
  async runScheduledFullDatabaseBackup(): Promise<void> {
    if (process.env.BACKUP_DAILY_ENABLED !== 'true') return;

    await this.ensureBackupRoot();
    const job = await this.prisma.backupJob.create({
      data: {
        tenantId: null,
        companyId: null,
        scope: 'database_full',
        status: 'running',
      },
    });

    const t0 = Date.now();
    const root = this.getBackupRoot();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `full_${ts}_${job.id}`;
    const dumpPath = path.join(root, 'system', `${baseName}.dump`);
    const finalRel = path.join('system', `${baseName}.dump.gz`);
    const finalAbs = path.join(root, 'system', `${baseName}.dump.gz`);

    try {
      await fs.mkdir(path.dirname(dumpPath), { recursive: true });
      await this.runPgDumpToFile(dumpPath);
      await this.gzipFile(dumpPath, finalAbs);
      const hash = await this.sha256File(finalAbs);
      const dup = await this.findDuplicateJob(null, null, 'database_full', hash);
      if (dup && dup.id !== job.id) {
        await fs.unlink(finalAbs).catch(() => undefined);
        await this.prisma.backupJob.update({
          where: { id: job.id },
          data: {
            status: 'skipped_duplicate',
            contentHash: hash,
            duplicateOfJobId: dup.id,
            durationMs: Date.now() - t0,
            completedAt: new Date(),
            report: { messageAr: 'تكرار — نفس hash نسخة سابقة' },
          },
        });
        return;
      }

      const st = await fs.stat(finalAbs);
      let externalUploaded = false;
      let externalError: string | null = null;
      const up = await this.uploadToExternalIfConfigured(finalAbs, path.basename(finalRel), {
        scope: 'database_full',
        company: 'full_database',
      });
      if (up.ok) externalUploaded = true;
      else externalError = up.error || null;

      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          contentHash: hash,
          localRelativePath: finalRel,
          sizeBytes: st.size,
          durationMs: Date.now() - t0,
          completedAt: new Date(),
          externalUploaded,
          externalError,
        },
      });
      this.logger.log(`Full DB backup completed: ${finalRel} (${st.size} bytes)`);
    } catch (e) {
      const msg = (e as Error).message;
      this.logger.error(`Full DB backup failed: ${msg}`);
      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: msg,
          durationMs: Date.now() - t0,
          completedAt: new Date(),
        },
      });
    }
  }

  async listJobs(tenantId: string, allowedCompanyIds: string[] | undefined, limit = 40) {
    const take = Math.min(Math.max(limit, 1), 100);
    const or: Array<Record<string, unknown>> = [{ tenantId }];
    if (allowedCompanyIds?.length) {
      or.push({ companyId: { in: allowedCompanyIds } });
    }
    return this.prisma.backupJob.findMany({
      where: { OR: or },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        company: { select: { id: true, nameAr: true, nameEn: true } },
      },
    });
  }

  async getJob(tenantId: string, jobId: string, allowedCompanyIds: string[] | undefined) {
    const job = await this.prisma.backupJob.findFirst({
      where: {
        id: jobId,
        OR: [{ tenantId }, ...(allowedCompanyIds?.length ? [{ companyId: { in: allowedCompanyIds } }] : [])],
      },
      include: {
        company: { select: { id: true, nameAr: true, nameEn: true } },
      },
    });
    if (!job) throw new NotFoundException('النسخة غير موجودة');
    return job;
  }

  async getRestoreReport(tenantId: string, jobId: string, allowedCompanyIds: string[] | undefined) {
    const job = await this.getJob(tenantId, jobId, allowedCompanyIds);
    if (job.scope !== 'company_logical' || !job.localRelativePath) {
      return {
        jobId: job.id,
        scope: job.scope,
        messageAr:
          job.scope === 'database_full'
            ? 'استرجاع النسخة الكاملة يتم عبر pg_restore على الخادم — راجع مسؤول النظام.'
            : 'لا يوجد ملف لقطة لهذه المهمة.',
        messageEn: 'See system administrator for full DB restore.',
        tables: job.report as Record<string, unknown> | null,
      };
    }
    const abs = path.join(this.getBackupRoot(), job.localRelativePath);
    try {
      const buf = await fs.readFile(abs);
      const json = zlib.gunzipSync(buf).toString('utf8');
      const snap = JSON.parse(json) as {
        meta?: { format?: string; version?: number; exportedAt?: string; companyId?: string };
        counts?: Record<string, number>;
      };
      return {
        jobId: job.id,
        scope: job.scope,
        meta: snap.meta,
        counts: snap.counts,
        messageAr: 'تقرير استرجاع — راجع الأعدادات قبل الاستيراد في بيئة اختبار.',
        messageEn: 'Restore manifest — verify in a staging environment first.',
        integrity: { contentHash: job.contentHash, sizeBytes: job.sizeBytes?.toString?.() ?? String(job.sizeBytes) },
      };
    } catch {
      throw new BadRequestException('تعذّر قراءة ملف النسخة');
    }
  }

  async retryExternalUpload(tenantId: string, jobId: string, allowedCompanyIds: string[] | undefined) {
    const job = await this.getJob(tenantId, jobId, allowedCompanyIds);
    if (!job.localRelativePath) throw new BadRequestException('لا يوجد ملف محلي');
    if (job.externalUploaded) return { ok: true, message: 'مرفوع مسبقاً' };

    const abs = path.join(this.getBackupRoot(), job.localRelativePath);
    const coName = job.company?.nameAr || job.companyId || 'backup';
    const up = await this.uploadToExternalIfConfigured(abs, path.basename(job.localRelativePath), {
      scope: job.scope,
      company: coName,
    });

    await this.prisma.backupJob.update({
      where: { id: job.id },
      data: {
        externalUploaded: up.ok,
        externalError: up.ok ? null : up.error || 'فشل غير معروف',
      },
    });

    if (!up.ok) throw new BadRequestException(up.error || 'فشل الرفع');
    return { ok: true };
  }
}

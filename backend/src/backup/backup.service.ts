import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Client } from 'pg';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { spawn } from 'child_process';
import moment from 'moment-timezone';
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

  /** صف الإعدادات الافتراضي — يُنشأ عند أول استخدام */
  async ensureSystemBackupConfigRow() {
    const existing = await this.prisma.systemBackupConfig.findUnique({ where: { id: 'singleton' } });
    if (existing) return existing;
    const legacyEnv = process.env.BACKUP_DAILY_ENABLED === 'true';
    return this.prisma.systemBackupConfig.create({
      data: {
        id: 'singleton',
        enabled: legacyEnv,
        scheduleHour: 6,
        scheduleMinute: 0,
        retentionCount: 10,
        timezone: 'Asia/Riyadh',
      },
    });
  }

  private async nextOrdinalCompanyLogical(tenantId: string, companyId: string): Promise<number> {
    const a = await this.prisma.backupJob.aggregate({
      where: { tenantId, companyId, scope: 'company_logical', ordinal: { not: null } },
      _max: { ordinal: true },
    });
    return (a._max.ordinal ?? 0) + 1;
  }

  private async nextOrdinalFullDb(): Promise<number> {
    const a = await this.prisma.backupJob.aggregate({
      where: { scope: 'database_full', ordinal: { not: null } },
      _max: { ordinal: true },
    });
    return (a._max.ordinal ?? 0) + 1;
  }

  private async pruneSystemFullBackups(retentionCount: number): Promise<void> {
    const keep = Math.min(Math.max(retentionCount, 1), 50);
    const root = this.getBackupRoot();
    const victims = await this.prisma.backupJob.findMany({
      where: {
        scope: 'database_full',
        status: 'completed',
        localRelativePath: { not: null },
      },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      skip: keep,
    });
    for (const j of victims) {
      if (j.localRelativePath) {
        await fs.unlink(path.join(root, j.localRelativePath)).catch(() => undefined);
      }
      await this.prisma.backupJob.delete({ where: { id: j.id } }).catch(() => undefined);
    }
  }

  private async pruneCompanyLogicalBackups(tenantId: string, companyId: string, retentionCount: number): Promise<void> {
    const keep = Math.min(Math.max(retentionCount, 1), 50);
    const root = this.getBackupRoot();
    const victims = await this.prisma.backupJob.findMany({
      where: {
        tenantId,
        companyId,
        scope: 'company_logical',
        status: 'completed',
        localRelativePath: { not: null },
      },
      orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
      skip: keep,
    });
    for (const j of victims) {
      if (j.localRelativePath) {
        await fs.unlink(path.join(root, j.localRelativePath)).catch(() => undefined);
      }
      await this.prisma.backupJob.delete({ where: { id: j.id } }).catch(() => undefined);
    }
  }

  private async verifyPgCustomDumpGz(absGzPath: string): Promise<{ ok: boolean; error?: string }> {
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
          // localhost → no SSL needed; remote hosts (Supabase, RDS…) keep SSL
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

  /** تحقق تلقائي بعد نسخ شركة — لا يرمي للمجدول */
  private async runAutoVerifyCompanyLogicalJob(jobId: string): Promise<void> {
    const job = await this.prisma.backupJob.findUnique({ where: { id: jobId } });
    if (!job || job.scope !== 'company_logical' || !job.localRelativePath || job.status !== 'completed') return;
    const abs = path.join(this.getBackupRoot(), job.localRelativePath);
    const now = new Date();
    try {
      await fs.access(abs);
      const buf = await fs.readFile(abs);
      const json = zlib.gunzipSync(buf).toString('utf8');
      const snap = JSON.parse(json) as { meta?: { format?: string } };
      if (!snap?.meta || snap.meta.format !== 'noorix-company-logical') {
        throw new Error('تنسيق اللقطة غير صالح');
      }
      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: { verifyOk: true, verifyError: null, verifiedAt: now },
      });
    } catch (e) {
      const msg = (e as Error).message;
      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: { verifyOk: false, verifyError: msg, verifiedAt: now },
      });
      this.logger.warn(`Company backup auto-verify failed ${jobId}: ${msg}`);
    }
  }

  async executeCompanyLogicalBackup(params: {
    tenantId: string;
    userId: string | null;
    companyId: string;
    allowedCompanyIds: string[] | undefined;
    skipPermissionCheck: boolean;
    autoVerify: boolean;
    retentionCount: number;
  }): Promise<{ jobId: string }> {
    const { tenantId, userId, companyId, allowedCompanyIds, skipPermissionCheck, autoVerify, retentionCount } = params;
    if (!skipPermissionCheck) {
      if (allowedCompanyIds && !allowedCompanyIds.includes(companyId)) {
        throw new ForbiddenException('لا يمكنك نسخ هذه الشركة');
      }
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
        ...(userId ? { createdByUserId: userId } : {}),
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

      const ordinal = await this.nextOrdinalCompanyLogical(tenantId, companyId);
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
          ordinal,
          report: {
            counts: snapshot.counts,
            resumeHintAr: externalError
              ? 'يمكنك لاحقاً استخدام «إعادة رفع خارجي» لاستكمال التخزين السحابي'
              : undefined,
          },
        },
      });
      await this.pruneCompanyLogicalBackups(tenantId, companyId, retentionCount);
      if (autoVerify) {
        await this.runAutoVerifyCompanyLogicalJob(job.id);
      }
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

  async triggerCompanyLogicalBackup(params: {
    tenantId: string;
    userId: string;
    companyId: string;
    allowedCompanyIds: string[] | undefined;
  }): Promise<{ jobId: string }> {
    const { tenantId, userId, companyId, allowedCompanyIds } = params;
    const coCfg = await this.prisma.companyBackupConfig.findUnique({ where: { companyId } });
    const retention = Math.min(50, Math.max(1, coCfg?.retentionCount ?? 5));
    return this.executeCompanyLogicalBackup({
      tenantId,
      userId,
      companyId,
      allowedCompanyIds,
      skipPermissionCheck: false,
      autoVerify: true,
      retentionCount: retention,
    });
  }

  async runScheduledCompanyBackups(): Promise<void> {
    const configs = await this.prisma.companyBackupConfig.findMany({
      where: { enabled: true },
      include: { company: { select: { id: true, tenantId: true } } },
    });
    for (const cfg of configs) {
      const tz = cfg.timezone || 'Asia/Riyadh';
      const m = moment.tz(tz);
      const ymd = m.format('YYYY-MM-DD');
      const h = m.hour();
      const mi = m.minute();
      if (h !== cfg.scheduleHour || mi !== cfg.scheduleMinute) continue;
      if (cfg.lastRunDayRiyadh === ymd) continue;
      await this.prisma.companyBackupConfig.update({
        where: { id: cfg.id },
        data: { lastRunDayRiyadh: ymd },
      });
      const retention = Math.min(50, Math.max(1, cfg.retentionCount ?? 5));
      try {
        await this.executeCompanyLogicalBackup({
          tenantId: cfg.company.tenantId,
          userId: null,
          companyId: cfg.companyId,
          allowedCompanyIds: undefined,
          skipPermissionCheck: true,
          autoVerify: true,
          retentionCount: retention,
        });
      } catch (e) {
        this.logger.error(`Scheduled company backup failed ${cfg.companyId}: ${(e as Error).message}`);
      }
    }
  }

  /**
   * جدولة يومية: يُستدعى كل دقيقة — يتحقق من التوقيت بتوقيت الرياض (أو timezone في الإعدادات).
   */
  async maybeRunScheduledFullDatabaseBackup(): Promise<void> {
    const cfg = await this.ensureSystemBackupConfigRow();
    if (!cfg.enabled) return;

    const tz = cfg.timezone || 'Asia/Riyadh';
    const m = moment.tz(tz);
    const ymd = m.format('YYYY-MM-DD');
    const h = m.hour();
    const mi = m.minute();

    if (h !== cfg.scheduleHour || mi !== cfg.scheduleMinute) return;
    if (cfg.lastRunDayRiyadh === ymd) return;

    await this.prisma.systemBackupConfig.update({
      where: { id: 'singleton' },
      data: { lastRunDayRiyadh: ymd },
    });

    await this.runFullDatabaseBackup({ manual: false, retentionCount: cfg.retentionCount });
  }

  /**
   * نسخة كاملة للقاعدة — tenantId = null.
   * manual=true يتجاوز التحقق من enabled ويُشغَّل من الواجهة (مالك/مدير).
   */
  async runFullDatabaseBackup(opts: { manual?: boolean; retentionCount?: number } = {}): Promise<{ jobId: string }> {
    const cfg = await this.ensureSystemBackupConfigRow();
    const retention = opts.retentionCount ?? cfg.retentionCount ?? 10;
    if (!opts.manual && !cfg.enabled) {
      return { jobId: '' };
    }

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
        return { jobId: job.id };
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

      const ordinal = await this.nextOrdinalFullDb();
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
          ordinal,
        },
      });
      await this.pruneSystemFullBackups(retention);
      this.logger.log(`Full DB backup completed: ${finalRel} (${st.size} bytes) #${ordinal}`);
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
    return { jobId: job.id };
  }

  /** يُستدعى من المجدول — يتحقق من الساعة بتوقيت الإعدادات */
  async runScheduledFullDatabaseBackup(): Promise<void> {
    await this.maybeRunScheduledFullDatabaseBackup();
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

  async loadParsedSnapshotForImport(
    tenantId: string,
    jobId: string,
    allowedCompanyIds: string[] | undefined,
  ): Promise<Record<string, unknown>> {
    const job = await this.getJob(tenantId, jobId, allowedCompanyIds);
    if (job.scope !== 'company_logical' || !job.localRelativePath) {
      throw new BadRequestException('الاستيراد متاح لنسخ «شركة منطقية» فقط');
    }
    const abs = path.join(this.getBackupRoot(), job.localRelativePath);
    const buf = await fs.readFile(abs);
    const json = zlib.gunzipSync(buf).toString('utf8');
    const parsed = JSON.parse(json) as Record<string, unknown>;
    const meta = parsed.meta as { tenantId?: string } | undefined;
    if (meta?.tenantId && meta.tenantId !== tenantId) {
      throw new ForbiddenException('اللقطة لا تخص مستأجرك');
    }
    return parsed;
  }

  async resolveJobDownloadPath(
    tenantId: string,
    jobId: string,
    allowedCompanyIds: string[] | undefined,
  ): Promise<{ absolutePath: string; filename: string }> {
    const job = await this.getJob(tenantId, jobId, allowedCompanyIds);
    if (!job.localRelativePath) throw new BadRequestException('لا يوجد ملف للتنزيل');
    const abs = path.join(this.getBackupRoot(), job.localRelativePath);
    try {
      await fs.access(abs);
    } catch {
      throw new NotFoundException('الملف غير موجود على الخادم');
    }
    const filename = `noorix-backup-${job.scope}-${job.id}.json.gz`;
    return { absolutePath: abs, filename };
  }

  async getSystemBackupConfig() {
    const c = await this.ensureSystemBackupConfigRow();
    return {
      enabled: c.enabled,
      scheduleHour: c.scheduleHour,
      scheduleMinute: c.scheduleMinute,
      retentionCount: c.retentionCount,
      timezone: c.timezone,
      lastRunDayRiyadh: c.lastRunDayRiyadh,
    };
  }

  async updateSystemBackupConfig(dto: {
    enabled?: boolean;
    scheduleHour?: number;
    scheduleMinute?: number;
    retentionCount?: number;
  }) {
    await this.ensureSystemBackupConfigRow();
    return this.prisma.systemBackupConfig.update({
      where: { id: 'singleton' },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.scheduleHour !== undefined ? { scheduleHour: dto.scheduleHour } : {}),
        ...(dto.scheduleMinute !== undefined ? { scheduleMinute: dto.scheduleMinute } : {}),
        ...(dto.retentionCount !== undefined ? { retentionCount: dto.retentionCount } : {}),
      },
    });
  }

  async getCompanyBackupConfig(tenantId: string, companyId: string) {
    const co = await this.prisma.company.findFirst({
      where: { id: companyId, tenantId },
      select: { id: true },
    });
    if (!co) throw new NotFoundException('الشركة غير موجودة');
    const row = await this.prisma.companyBackupConfig.findUnique({ where: { companyId } });
    if (!row) {
      return {
        companyId,
        enabled: false,
        scheduleHour: 6,
        scheduleMinute: 0,
        retentionCount: 5,
        timezone: 'Asia/Riyadh',
        lastRunDayRiyadh: null as string | null,
      };
    }
    return {
      companyId: row.companyId,
      enabled: row.enabled,
      scheduleHour: row.scheduleHour,
      scheduleMinute: row.scheduleMinute,
      retentionCount: row.retentionCount,
      timezone: row.timezone,
      lastRunDayRiyadh: row.lastRunDayRiyadh,
    };
  }

  async upsertCompanyBackupConfig(
    tenantId: string,
    dto: {
      companyId: string;
      enabled?: boolean;
      scheduleHour?: number;
      scheduleMinute?: number;
      retentionCount?: number;
      timezone?: string;
    },
  ) {
    const co = await this.prisma.company.findFirst({
      where: { id: dto.companyId, tenantId },
      select: { id: true },
    });
    if (!co) throw new NotFoundException('الشركة غير موجودة');
    const existing = await this.prisma.companyBackupConfig.findUnique({ where: { companyId: dto.companyId } });
    const patch = {
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.scheduleHour !== undefined ? { scheduleHour: Math.min(23, Math.max(0, dto.scheduleHour)) } : {}),
      ...(dto.scheduleMinute !== undefined ? { scheduleMinute: Math.min(59, Math.max(0, dto.scheduleMinute)) } : {}),
      ...(dto.retentionCount !== undefined
        ? { retentionCount: Math.min(50, Math.max(1, dto.retentionCount)) }
        : {}),
      ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
    };
    const row = existing
      ? await this.prisma.companyBackupConfig.update({ where: { companyId: dto.companyId }, data: patch })
      : await this.prisma.companyBackupConfig.create({
          data: {
            tenantId,
            companyId: dto.companyId,
            enabled: dto.enabled ?? false,
            scheduleHour: dto.scheduleHour ?? 6,
            scheduleMinute: dto.scheduleMinute ?? 0,
            retentionCount: dto.retentionCount ?? 5,
            timezone: dto.timezone ?? 'Asia/Riyadh',
          },
        });
    return {
      companyId: row.companyId,
      enabled: row.enabled,
      scheduleHour: row.scheduleHour,
      scheduleMinute: row.scheduleMinute,
      retentionCount: row.retentionCount,
      timezone: row.timezone,
      lastRunDayRiyadh: row.lastRunDayRiyadh,
    };
  }

  async listSystemFullJobs(limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    return this.prisma.backupJob.findMany({
      where: { scope: 'database_full' },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async verifyDatabaseFullJob(jobId: string) {
    const job = await this.prisma.backupJob.findFirst({
      where: { id: jobId, scope: 'database_full' },
    });
    if (!job) throw new NotFoundException('النسخة غير موجودة');
    if (job.status !== 'completed' || !job.localRelativePath) {
      throw new BadRequestException('التحقق متاح للنسخ المكتملة التي يوجد لها ملف');
    }
    const abs = path.join(this.getBackupRoot(), job.localRelativePath);
    try {
      await fs.access(abs);
    } catch {
      throw new NotFoundException('الملف غير موجود على الخادم');
    }
    const v = await this.verifyPgCustomDumpGz(abs);
    const now = new Date();
    await this.prisma.backupJob.update({
      where: { id: job.id },
      data: {
        verifyOk: v.ok,
        verifyError: v.ok ? null : v.error ?? 'فشل',
        verifiedAt: now,
      },
    });
    if (!v.ok) throw new BadRequestException(v.error || 'فشل التحقق من النسخة');
    return { ok: true, jobId: job.id };
  }

  /**
   * استرداد قاعدة كاملة من نسخة database_full — خطير؛ يتطلب عبارة تأكيد.
   * بعد النجاح يُفضّل إعادة تشغيل الباكند (انظر BACKUP_RESTORE_EXIT_AFTER).
   */
  async restoreDatabaseFullJob(
    jobId: string,
    confirmPhrase: string,
  ): Promise<{ ok: boolean; messageAr: string; messageEn: string; exitAfter: boolean }> {
    const expected = process.env.BACKUP_RESTORE_CONFIRM_PHRASE || 'RESTORE_NOORIX_FULL_DB';
    if (confirmPhrase !== expected) {
      throw new ForbiddenException('عبارة التأكيد غير صحيحة.');
    }
    const job = await this.prisma.backupJob.findFirst({
      where: { id: jobId, scope: 'database_full' },
    });
    if (!job) throw new NotFoundException('النسخة غير موجودة');
    if (job.status !== 'completed' || !job.localRelativePath) {
      throw new BadRequestException('الاسترداد متاح للنسخ المكتملة التي يوجد لها ملف');
    }
    const absGz = path.join(this.getBackupRoot(), job.localRelativePath);
    try {
      await fs.access(absGz);
    } catch {
      throw new NotFoundException('الملف غير موجود على الخادم');
    }
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) throw new BadRequestException('DATABASE_URL غير مُعرّف');
    const { host, port, user, password, database } = this.parseDatabaseUrl(dbUrl.split('?')[0]);
    const tmp = path.join(os.tmpdir(), `noorix-restore-${Date.now()}-${Math.random().toString(36).slice(2)}.dump`);
    try {
      const buf = await fs.readFile(absGz);
      const unz = zlib.gunzipSync(buf);
      await fs.writeFile(tmp, unz);
    } catch (e) {
      throw new BadRequestException(`تعذّر فك ملف النسخة: ${(e as Error).message}`);
    }

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
        ['--clean', '--if-exists', '--no-owner', '--no-acl', '-h', host, '-p', port, '-U', user, '-d', database, tmp],
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
    await fs.unlink(tmp).catch(() => undefined);
    const exitAfter = process.env.BACKUP_RESTORE_EXIT_AFTER === 'true';
    return {
      ok: true,
      messageAr:
        'تم استرداد القاعدة. أعد تشغيل خدمة الباكند إن لم يُعِد التشغيل تلقائياً.',
      messageEn: 'Database restored. Restart the backend if it did not restart automatically.',
      exitAfter,
    };
  }

  async verifyCompanyLogicalJob(
    tenantId: string,
    jobId: string,
    allowedCompanyIds: string[] | undefined,
  ) {
    const job = await this.getJob(tenantId, jobId, allowedCompanyIds);
    if (job.scope !== 'company_logical' || !job.localRelativePath) {
      throw new BadRequestException('التحقق متاح لنسخ الشركة المكتملة فقط');
    }
    if (job.status !== 'completed') {
      throw new BadRequestException('التحقق متاح للنسخ المكتملة فقط');
    }
    const abs = path.join(this.getBackupRoot(), job.localRelativePath);
    try {
      await fs.access(abs);
    } catch {
      throw new NotFoundException('الملف غير موجود على الخادم');
    }
    const now = new Date();
    try {
      const buf = await fs.readFile(abs);
      const json = zlib.gunzipSync(buf).toString('utf8');
      const snap = JSON.parse(json) as { meta?: { format?: string; version?: number } };
      if (!snap?.meta || snap.meta.format !== 'noorix-company-logical') {
        throw new Error('تنسيق اللقطة غير صالح — المتوقع: noorix-company-logical');
      }
      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: { verifyOk: true, verifyError: null, verifiedAt: now },
      });
      return { ok: true, jobId: job.id };
    } catch (e) {
      const msg = (e as Error).message;
      await this.prisma.backupJob.update({
        where: { id: job.id },
        data: { verifyOk: false, verifyError: msg, verifiedAt: now },
      });
      throw new BadRequestException(`ملف لقطة تالف أو غير صالح: ${msg}`);
    }
  }

  /**
   * تنزيل ملف نسخة قاعدة كاملة (pg_dump مضغوط gzip) — لمالك النظام فقط من الـ controller.
   */
  async resolveSystemFullJobDownloadPath(jobId: string): Promise<{ absolutePath: string; filename: string }> {
    const job = await this.prisma.backupJob.findFirst({
      where: { id: jobId, scope: 'database_full' },
    });
    if (!job) throw new NotFoundException('النسخة غير موجودة');
    if (job.status !== 'completed' || !job.localRelativePath) {
      throw new BadRequestException('التنزيل متاح للنسخ المكتملة التي يوجد لها ملف');
    }
    const abs = path.join(this.getBackupRoot(), job.localRelativePath);
    try {
      await fs.access(abs);
    } catch {
      throw new NotFoundException('الملف غير موجود على الخادم');
    }
    const ord = job.ordinal != null ? String(job.ordinal) : 'na';
    const filename = `noorix-full-db-${ord}-${job.id}.dump.gz`;
    return { absolutePath: abs, filename };
  }

  /**
   * استقبال ملف .dump.gz مرفوعاً من الواجهة — التحقق بـ pg_restore -l ثم تسجيله كنسخة نظام.
   */
  async ingestUploadedFullDatabaseDump(opts: {
    tempPath: string;
    originalFilename?: string;
    userId?: string;
  }): Promise<{ jobId: string; status: string; duplicateOfJobId?: string }> {
    const { tempPath, originalFilename, userId } = opts;
    try {
      await fs.access(tempPath);
    } catch {
      throw new BadRequestException('ملف الرفع غير موجود');
    }

    await this.ensureBackupRoot();
    const cfg = await this.ensureSystemBackupConfigRow();
    const retention = cfg.retentionCount ?? 10;

    const job = await this.prisma.backupJob.create({
      data: {
        tenantId: null,
        companyId: null,
        scope: 'database_full',
        status: 'running',
        createdByUserId: userId ?? null,
      },
    });

    const t0 = Date.now();
    const root = this.getBackupRoot();
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const finalRel = path.join('system', `imported_${ts}_${job.id}.dump.gz`);
    const finalAbs = path.join(root, finalRel);

    const cleanupTemp = async () => {
      await fs.unlink(tempPath).catch(() => undefined);
    };

    try {
      await fs.mkdir(path.dirname(finalAbs), { recursive: true });
      await fs.copyFile(tempPath, finalAbs);
      await cleanupTemp();

      const v = await this.verifyPgCustomDumpGz(finalAbs);
      if (!v.ok) {
        await fs.unlink(finalAbs).catch(() => undefined);
        await this.prisma.backupJob.update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: v.error || 'فشل التحقق من تنسيق النسخة',
            durationMs: Date.now() - t0,
            completedAt: new Date(),
          },
        });
        throw new BadRequestException(v.error || 'الملف ليس نسخة pg_dump مخصّصة مضغوطة بصيغة gzip صالحة');
      }

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
            report: {
              messageAr: 'تكرار — نفس hash نسخة سابقة',
              source: 'local_upload',
              originalFilename: originalFilename ?? null,
            },
          },
        });
        return { jobId: job.id, status: 'skipped_duplicate', duplicateOfJobId: dup.id };
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

      const ordinal = await this.nextOrdinalFullDb();
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
          ordinal,
          verifyOk: true,
          verifyError: null,
          verifiedAt: new Date(),
          report: { source: 'local_upload', originalFilename: originalFilename ?? null },
        },
      });
      await this.pruneSystemFullBackups(retention);
      this.logger.log(`Full DB uploaded from PC: ${finalRel} (${st.size} bytes) #${ordinal}`);
      return { jobId: job.id, status: 'completed' };
    } catch (e) {
      await cleanupTemp();
      if (e instanceof BadRequestException) throw e;
      const msg = (e as Error).message;
      this.logger.error(`Full DB upload ingest failed: ${msg}`);
      await this.prisma.backupJob
        .update({
          where: { id: job.id },
          data: {
            status: 'failed',
            errorMessage: msg,
            durationMs: Date.now() - t0,
            completedAt: new Date(),
          },
        })
        .catch(() => undefined);
      await fs.unlink(finalAbs).catch(() => undefined);
      throw new BadRequestException(msg);
    }
  }
}

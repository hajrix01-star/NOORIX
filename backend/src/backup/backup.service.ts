import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import moment from 'moment-timezone';
import { getBackupRoot } from './backup-env-paths.util';
import { resolveExternalUploadOpts } from './backup-external-upload-opts.util';
import { runVerifyDatabaseFullJob } from './backup-verify-database-full-job.util';
import { runResolveSystemFullJobDownloadPath } from './backup-system-full-job-download.util';
import {
  getBackupJob,
  getBackupRestoreReport,
  listBackupJobs,
  loadParsedLogicalSnapshotForImport,
  resolveBackupJobDownloadPath,
  verifyCompanyLogicalBackupJob,
} from './backup-job-access.util';
import { ingestUploadedSystemFullArchive as runIngestUploadedSystemFullArchive } from './backup-ingest-system-full-archive.util';
import { runCompanyLogicalBackup } from './backup-company-logical-execute.util';
import { runSystemFullArchiveJob } from './backup-system-full-archive-run.util';
import { uploadToExternalIfConfigured } from './backup-gdrive-upload.util';
import { getCompanyBackupConfigView, upsertCompanyBackupConfigView } from './backup-company-backup-config.util';
import { runRestoreFromBackupJobRecord, runRestoreSystemFullFromUploadedTar } from './backup-restore-operations.util';

@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async ensureBackupRoot(): Promise<void> {
    const root = getBackupRoot();
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

  private async resolveExternalUploadOpts(
    scope: string,
    companyId: string | null,
  ): Promise<{ scriptUrl: string | null; folderId: string | null }> {
    return resolveExternalUploadOpts(
      { prisma: this.prisma, ensureSystemBackupConfigRow: () => this.ensureSystemBackupConfigRow() },
      scope,
      companyId,
    );
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
    return runCompanyLogicalBackup(
      {
        prisma: this.prisma,
        logger: this.logger,
        ensureBackupRoot: () => this.ensureBackupRoot(),
        resolveExternalUploadOpts: (scope, companyId) => this.resolveExternalUploadOpts(scope, companyId),
      },
      params,
    );
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
   * جدولة يومية: يُستدعى كل دقيقة — أرشيف نظام كامل (قاعدة + uploads) عند التفعيل.
   */
  async maybeRunScheduledSystemFullBackup(): Promise<void> {
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

    await this.runSystemFullArchive({ manual: false, retentionCount: cfg.retentionCount });
  }

  /**
   * أرشيف نظام كامل: pg_dump (custom) + مجلد uploads في ملف tar.gz واحد.
   * يدوياً: POST backup/system/run-full-archive | أسبوعياً: عيّن BACKUP_SYSTEM_FULL_WEEKLY=1 و BACKUP_SYSTEM_FULL_WEEKDAY/HOUR/MINUTE
   */
  async runSystemFullArchive(opts: { manual?: boolean; retentionCount?: number } = {}): Promise<{ jobId: string }> {
    return runSystemFullArchiveJob(
      {
        prisma: this.prisma,
        logger: this.logger,
        ensureBackupRoot: () => this.ensureBackupRoot(),
        ensureSystemBackupConfigRow: () => this.ensureSystemBackupConfigRow(),
        resolveExternalUploadOpts: (scope, companyId) => this.resolveExternalUploadOpts(scope, companyId),
      },
      opts,
    );
  }

  async maybeRunScheduledSystemFullArchive(): Promise<void> {
    if (process.env.BACKUP_SYSTEM_FULL_WEEKLY !== '1' && process.env.BACKUP_SYSTEM_FULL_ENABLED !== 'true') {
      return;
    }
    const cfg = await this.ensureSystemBackupConfigRow();
    const tz = cfg.timezone || 'Asia/Riyadh';
    const m = moment.tz(tz);
    const wantDay = Math.min(6, Math.max(0, parseInt(process.env.BACKUP_SYSTEM_FULL_WEEKDAY ?? '0', 10)));
    const wantHour = Math.min(23, Math.max(0, parseInt(process.env.BACKUP_SYSTEM_FULL_HOUR ?? '3', 10)));
    const wantMin = Math.min(59, Math.max(0, parseInt(process.env.BACKUP_SYSTEM_FULL_MINUTE ?? '0', 10)));
    if (m.day() !== wantDay || m.hour() !== wantHour || m.minute() !== wantMin) return;

    const ymd = m.format('YYYY-MM-DD');
    const last = await this.prisma.backupJob.findFirst({
      where: { scope: 'system_full', status: 'completed', completedAt: { not: null } },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    });
    if (last?.completedAt && moment(last.completedAt).tz(tz).format('YYYY-MM-DD') === ymd) return;

    await this.runSystemFullArchive({ manual: false, retentionCount: cfg.retentionCount });
  }

  /** @deprecated استخدم maybeRunScheduledSystemFullBackup — مُبقى للتوافق مع استدعاءات قديمة */
  async runScheduledFullDatabaseBackup(): Promise<void> {
    await this.maybeRunScheduledSystemFullBackup();
  }

  async listJobs(tenantId: string, allowedCompanyIds: string[] | undefined, limit = 40) {
    return listBackupJobs(this.prisma, tenantId, allowedCompanyIds, limit);
  }

  async getJob(tenantId: string, jobId: string, allowedCompanyIds: string[] | undefined) {
    return getBackupJob(this.prisma, tenantId, jobId, allowedCompanyIds);
  }

  async getRestoreReport(tenantId: string, jobId: string, allowedCompanyIds: string[] | undefined) {
    return getBackupRestoreReport(this.prisma, tenantId, jobId, allowedCompanyIds);
  }

  async retryExternalUpload(tenantId: string, jobId: string, allowedCompanyIds: string[] | undefined) {
    const job = await this.getJob(tenantId, jobId, allowedCompanyIds);
    if (!job.localRelativePath) throw new BadRequestException('لا يوجد ملف محلي');
    if (job.externalUploaded) return { ok: true, message: 'مرفوع مسبقاً' };

    const abs = path.join(getBackupRoot(), job.localRelativePath);
    const coName = job.company?.nameAr || job.companyId || 'backup';
    const extRetry = await this.resolveExternalUploadOpts(job.scope, job.companyId);
    const up = await uploadToExternalIfConfigured(abs, path.basename(job.localRelativePath), {
      scope: job.scope,
      company: coName,
    }, extRetry);

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
    return loadParsedLogicalSnapshotForImport(this.prisma, tenantId, jobId, allowedCompanyIds);
  }

  async resolveJobDownloadPath(
    tenantId: string,
    jobId: string,
    allowedCompanyIds: string[] | undefined,
  ): Promise<{ absolutePath: string; filename: string }> {
    return resolveBackupJobDownloadPath(this.prisma, tenantId, jobId, allowedCompanyIds);
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
      gdriveScriptUrl: null,
      gdriveFolderId: null,
    };
  }

  async updateSystemBackupConfig(dto: {
    enabled?: boolean;
    scheduleHour?: number;
    scheduleMinute?: number;
    retentionCount?: number;
    gdriveScriptUrl?: string;
    gdriveFolderId?: string;
  }) {
    await this.ensureSystemBackupConfigRow();
    return this.prisma.systemBackupConfig.update({
      where: { id: 'singleton' },
      data: {
        ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        ...(dto.scheduleHour !== undefined ? { scheduleHour: dto.scheduleHour } : {}),
        ...(dto.scheduleMinute !== undefined ? { scheduleMinute: dto.scheduleMinute } : {}),
        ...(dto.retentionCount !== undefined ? { retentionCount: dto.retentionCount } : {}),
        gdriveScriptUrl: null,
        gdriveFolderId: null,
      },
    });
  }

  async getCompanyBackupConfig(tenantId: string, companyId: string) {
    return getCompanyBackupConfigView(this.prisma, tenantId, companyId);
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
      gdriveScriptUrl?: string;
      gdriveFolderId?: string;
    },
  ) {
    return upsertCompanyBackupConfigView(this.prisma, tenantId, dto);
  }

  async listSystemFullJobs(limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    return this.prisma.backupJob.findMany({
      where: { scope: 'system_full' },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  async verifyDatabaseFullJob(jobId: string) {
    return runVerifyDatabaseFullJob(this.prisma, jobId);
  }

  /**
   * استرداد أرشيف نظام مرفوع من الجهاز — خطير؛ يتطلب عبارة تأكيد ثم يحذف الملف المؤقت.
   */
  async restoreSystemFullFromUploadedTar(opts: {
    tempPath: string;
    confirmPhrase: string;
  }): Promise<{ ok: boolean; messageAr: string; messageEn: string; exitAfter: boolean }> {
    return runRestoreSystemFullFromUploadedTar(opts);
  }

  /**
   * استرداد من نسخة نظام: system_full (أرشيف tar.gz) أو database_full قديمة (.dump.gz) — خطير؛ يتطلب عبارة تأكيد.
   * بعد النجاح يُفضّل إعادة تشغيل الباكند (انظر BACKUP_RESTORE_EXIT_AFTER).
   */
  async restoreDatabaseFullJob(
    jobId: string,
    confirmPhrase: string,
  ): Promise<{ ok: boolean; messageAr: string; messageEn: string; exitAfter: boolean }> {
    return runRestoreFromBackupJobRecord(this.prisma, jobId, confirmPhrase);
  }

  async verifyCompanyLogicalJob(
    tenantId: string,
    jobId: string,
    allowedCompanyIds: string[] | undefined,
  ) {
    return verifyCompanyLogicalBackupJob(this.prisma, tenantId, jobId, allowedCompanyIds);
  }

  async resolveSystemFullJobDownloadPath(jobId: string): Promise<{ absolutePath: string; filename: string }> {
    return runResolveSystemFullJobDownloadPath(this.prisma, jobId);
  }

  /**
   * استقبال أرشيف نظام .tar.gz من الواجهة (db.dump + uploads) — التحقق ثم تسجيله كنسخة system_full.
   */
  async ingestUploadedSystemFullArchive(opts: {
    tempPath: string;
    originalFilename?: string;
    userId?: string;
  }): Promise<{ jobId: string; status: string; duplicateOfJobId?: string }> {
    return runIngestUploadedSystemFullArchive(
      {
        prisma: this.prisma,
        logger: this.logger,
        ensureBackupRoot: () => this.ensureBackupRoot(),
        ensureSystemBackupConfigRow: () => this.ensureSystemBackupConfigRow(),
        resolveExternalUploadOpts: (scope, companyId) => this.resolveExternalUploadOpts(scope, companyId),
      },
      opts,
    );
  }
}

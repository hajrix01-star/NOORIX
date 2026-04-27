import { BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { getBackupRoot } from './backup-env-paths.util';
import { sha256File } from './backup-file-helpers.util';
import { uploadToExternalIfConfigured } from './backup-gdrive-upload.util';
import {
  findDuplicateBackupJob,
  nextOrdinalSystemFull,
  pruneSystemFullArchiveJobs,
} from './backup-job-helpers.util';
import { verifySystemFullTarGz } from './backup-system-full-restore.util';

export type IngestSystemFullArchiveContext = {
  prisma: PrismaService;
  logger: Pick<Logger, 'log' | 'error'>;
  ensureBackupRoot: () => Promise<void>;
  ensureSystemBackupConfigRow: () => Promise<{ retentionCount: number | null }>;
  resolveExternalUploadOpts: (
    scope: string,
    companyId: string | null,
  ) => Promise<{ scriptUrl: string | null; folderId: string | null }>;
};

/**
 * استقبال أرشيف نظام .tar.gz من الواجهة (db.dump + uploads) — التحقق ثم تسجيله كنسخة system_full.
 */
export async function ingestUploadedSystemFullArchive(
  ctx: IngestSystemFullArchiveContext,
  opts: {
    tempPath: string;
    originalFilename?: string;
    userId?: string;
  },
): Promise<{ jobId: string; status: string; duplicateOfJobId?: string }> {
  const { prisma, logger, ensureBackupRoot, ensureSystemBackupConfigRow, resolveExternalUploadOpts } = ctx;
  const { tempPath, originalFilename, userId } = opts;
  try {
    await fs.access(tempPath);
  } catch {
    throw new BadRequestException('ملف الرفع غير موجود');
  }

  await ensureBackupRoot();
  const cfg = await ensureSystemBackupConfigRow();
  const retention = cfg.retentionCount ?? 10;

  const job = await prisma.backupJob.create({
    data: {
      tenantId: null,
      companyId: null,
      scope: 'system_full',
      status: 'running',
      createdByUserId: userId ?? null,
    },
  });

  const t0 = Date.now();
  const root = getBackupRoot();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const finalRel = path.join('system', `imported_${ts}_${job.id}.tar.gz`);
  const finalAbs = path.join(root, finalRel);

  const cleanupTemp = async () => {
    await fs.unlink(tempPath).catch(() => undefined);
  };

  try {
    await fs.mkdir(path.dirname(finalAbs), { recursive: true });
    await fs.copyFile(tempPath, finalAbs);
    await cleanupTemp();

    const v = await verifySystemFullTarGz(finalAbs);
    if (!v.ok) {
      await fs.unlink(finalAbs).catch(() => undefined);
      await prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          errorMessage: v.error || 'فشل التحقق من تنسيق الأرشيف',
          durationMs: Date.now() - t0,
          completedAt: new Date(),
        },
      });
      throw new BadRequestException(v.error || 'الملف ليس أرشيف نظام صالحاً (tar.gz يحتوي db.dump)');
    }

    const hash = await sha256File(finalAbs);
    const dup = await findDuplicateBackupJob(prisma, null, null, 'system_full', hash);
    if (dup && dup.id !== job.id) {
      await fs.unlink(finalAbs).catch(() => undefined);
      await prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'skipped_duplicate',
          contentHash: hash,
          duplicateOfJobId: dup.id,
          durationMs: Date.now() - t0,
          completedAt: new Date(),
          report: {
            messageAr: 'تكرار — نفس hash أرشيف سابق',
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
    const extOptsImport = await resolveExternalUploadOpts('system_full', null);
    const up = await uploadToExternalIfConfigured(finalAbs, path.basename(finalRel), {
      scope: 'system_full',
      company: 'system_archive',
    }, extOptsImport);
    if (up.ok) externalUploaded = true;
    else externalError = up.error || null;

    const ordinal = await nextOrdinalSystemFull(prisma);
    await prisma.backupJob.update({
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
        report: {
          source: 'local_upload',
          originalFilename: originalFilename ?? null,
          messageAr: 'أرشيف مرفوع: قاعدة + uploads إن وُجد',
        },
      },
    });
    await pruneSystemFullArchiveJobs(prisma, retention);
    logger.log(`System full archive uploaded from PC: ${finalRel} (${st.size} bytes) #${ordinal}`);
    return { jobId: job.id, status: 'completed' };
  } catch (e) {
    await cleanupTemp();
    if (e instanceof BadRequestException) throw e;
    const msg = (e as Error).message;
    logger.error(`System archive upload ingest failed: ${msg}`);
    await prisma.backupJob
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

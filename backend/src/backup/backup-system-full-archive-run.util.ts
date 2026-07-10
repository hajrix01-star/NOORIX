import { Logger } from '@nestjs/common';
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
import {
  buildSourceDatabaseFingerprint,
  verifySystemFullArchiveDataParity,
} from './backup-system-full-parity-verify.util';
import { packSystemFullArchiveToDisk } from './backup-system-full-tar-pack.util';
import { verifySystemFullTarGz } from './backup-system-full-restore.util';

export type SystemFullArchiveRunContext = {
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
 * أرشيف نظام كامل: pg_dump (custom) + مجلد uploads في ملف tar.gz واحد.
 */
export async function runSystemFullArchiveJob(
  ctx: SystemFullArchiveRunContext,
  opts: { manual?: boolean; retentionCount?: number } = {},
): Promise<{ jobId: string }> {
  const { prisma, logger, ensureBackupRoot, ensureSystemBackupConfigRow, resolveExternalUploadOpts } = ctx;
  const cfg = await ensureSystemBackupConfigRow();
  const retention = opts.retentionCount ?? cfg.retentionCount ?? 10;

  await ensureBackupRoot();
  const job = await prisma.backupJob.create({
    data: {
      tenantId: null,
      companyId: null,
      scope: 'system_full',
      status: 'running',
    },
  });

  const t0 = Date.now();
  const root = getBackupRoot();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const baseName = `fullsys_${ts}_${job.id}`;

  try {
    const sourceFingerprint = await buildSourceDatabaseFingerprint();
    const { finalAbs, finalRel, hasUploads } = await packSystemFullArchiveToDisk({ root, baseName });

    const hash = await sha256File(finalAbs);
    const verifyResult = await verifySystemFullTarGz(finalAbs);
    if (!verifyResult.ok) {
      throw new Error(verifyResult.error || 'System full archive verification failed');
    }

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
          report: { messageAr: 'تكرار — نفس hash أرشيف سابق' },
        },
      });
      return { jobId: job.id };
    }

    const parityReport = await verifySystemFullArchiveDataParity(finalAbs, sourceFingerprint);
    if (!parityReport.ok) {
      throw new Error(`System full archive data parity failed: ${parityReport.mismatches.slice(0, 5).join('; ')}`);
    }

    const st = await fs.stat(finalAbs);
    let externalUploaded = false;
    let externalError: string | null = null;
    const extOpts = await resolveExternalUploadOpts('system_full', null);
    const up = await uploadToExternalIfConfigured(finalAbs, path.basename(finalRel), {
      scope: 'system_full',
      company: 'system_archive',
    }, extOpts);
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
          messageAr: 'أرشيف: قاعدة (pg_dump custom) + uploads إن وُجد',
          includesUploads: hasUploads,
          dataParity: parityReport,
        },
      },
    });
    await pruneSystemFullArchiveJobs(prisma, retention);
    logger.log(`System full archive completed: ${finalRel} (${st.size} bytes) #${ordinal}`);
  } catch (e) {
    const msg = (e as Error).message;
    logger.error(`System full archive failed: ${msg}`);
    await fs.unlink(path.join(getBackupRoot(), 'system', `${baseName}.tar.gz`)).catch(() => undefined);
    await prisma.backupJob.update({
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

import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { buildCompanyLogicalSnapshot } from './backup-company-export';
import { getBackupRoot } from './backup-env-paths.util';
import { runAutoVerifyCompanyLogicalJob } from './backup-company-logical-auto-verify.util';
import { createAttachmentsTarball } from './backup-attachments-tar.util';
import { uploadToExternalIfConfigured } from './backup-gdrive-upload.util';
import { gzipBufferLevel9 } from './backup-gzip-buffer.util';
import {
  findDuplicateBackupJob,
  nextOrdinalCompanyLogical,
  pruneCompanyLogicalBackups,
} from './backup-job-helpers.util';
import { stringifyLogicalSnapshotReplacingDecimals } from './backup-company-snapshot-json.util';

export type CompanyLogicalBackupContext = {
  prisma: PrismaService;
  logger: Pick<Logger, 'error' | 'warn'>;
  ensureBackupRoot: () => Promise<void>;
  resolveExternalUploadOpts: (
    scope: string,
    companyId: string | null,
  ) => Promise<{ scriptUrl: string | null; folderId: string | null }>;
};

/**
 * نسخ منطقي لشركة: لقطة JSON مضغوطة + اختياري مرفقات + رفع خارجي + قصّ الاحتفاظ.
 */
export async function runCompanyLogicalBackup(
  ctx: CompanyLogicalBackupContext,
  params: {
    tenantId: string;
    userId: string | null;
    companyId: string;
    allowedCompanyIds: string[] | undefined;
    skipPermissionCheck: boolean;
    autoVerify: boolean;
    retentionCount: number;
  },
): Promise<{ jobId: string }> {
  const { prisma, logger, ensureBackupRoot, resolveExternalUploadOpts } = ctx;
  const { tenantId, userId, companyId, allowedCompanyIds, skipPermissionCheck, autoVerify, retentionCount } = params;
  if (!skipPermissionCheck) {
    if (allowedCompanyIds && !allowedCompanyIds.includes(companyId)) {
      throw new ForbiddenException('لا يمكنك نسخ هذه الشركة');
    }
  }
  const co = await prisma.company.findFirst({
    where: { id: companyId, tenantId },
    select: { id: true, nameAr: true },
  });
  if (!co) throw new NotFoundException('الشركة غير موجودة');

  await ensureBackupRoot();
  const job = await prisma.backupJob.create({
    data: {
      tenantId,
      companyId,
      scope: 'company_logical',
      status: 'running',
      ...(userId ? { createdByUserId: userId } : {}),
    },
  });

  const t0 = Date.now();
  const root = getBackupRoot();
  const rel = path.join('tenant', tenantId, 'company', `${companyId}_${job.id}.json.gz`);
  const abs = path.join(root, rel);

  try {
    await fs.mkdir(path.dirname(abs), { recursive: true });
    const snapshot = await buildCompanyLogicalSnapshot(prisma, companyId);
    const json = stringifyLogicalSnapshotReplacingDecimals(snapshot);
    const zipped = await gzipBufferLevel9(Buffer.from(json, 'utf8'));
    await fs.writeFile(abs, zipped);

    const hash = crypto.createHash('sha256').update(zipped).digest('hex');
    const dup = await findDuplicateBackupJob(prisma, tenantId, companyId, 'company_logical', hash);
    if (dup && dup.id !== job.id) {
      await fs.unlink(abs).catch(() => undefined);
      await prisma.backupJob.update({
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

    let attachmentsRel: string | null = null;
    const manifest = snapshot.attachmentManifest;
    if (manifest && manifest.length > 0) {
      const relTar = path.join('tenant', tenantId, 'company', `${companyId}_${job.id}.attachments.tar.gz`);
      const absTar = path.join(root, relTar);
      await createAttachmentsTarball(manifest, absTar);
      attachmentsRel = relTar;
    }

    const st = await fs.stat(abs);
    let externalUploaded = false;
    let externalError: string | null = null;
    const extOpts = await resolveExternalUploadOpts('company_logical', companyId);
    const up = await uploadToExternalIfConfigured(abs, path.basename(rel), {
      scope: 'company_logical',
      company: co.nameAr || companyId,
    }, extOpts);
    if (up.ok) externalUploaded = true;
    else externalError = up.error || null;

    const ordinal = await nextOrdinalCompanyLogical(prisma, tenantId, companyId);
    await prisma.backupJob.update({
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
          attachmentsArchiveRelativePath: attachmentsRel,
          resumeHintAr: externalError
            ? 'يمكنك لاحقاً استخدام «إعادة رفع خارجي» لاستكمال التخزين السحابي'
            : undefined,
        },
      },
    });
    await pruneCompanyLogicalBackups(prisma, tenantId, companyId, retentionCount);
    if (autoVerify) {
      await runAutoVerifyCompanyLogicalJob(prisma, job.id, (m) => logger.warn(m));
    }
    return { jobId: job.id };
  } catch (e) {
    const msg = (e as Error).message;
    logger.error(`Company backup failed: ${msg}`);
    await prisma.backupJob.update({
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

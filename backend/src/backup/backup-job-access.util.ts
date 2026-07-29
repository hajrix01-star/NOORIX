import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { getBackupRoot } from './backup-env-paths.util';
import {
  assertSnapshotBelongsToTenant,
  readGzippedJsonByBackupRelativePath,
} from './backup-company-logical-snapshot-read.util';
import {
  buildCompanyLogicalRestoreReport,
  buildNonLogicalBackupRestoreReport,
  resolveLocalBackupFileOrThrow,
} from './backup-restore-report.util';
import { runManualCompanyLogicalJobVerify } from './backup-company-logical-verify-manual.util';

export async function listBackupJobs(
  prisma: PrismaService,
  tenantId: string,
  allowedCompanyIds: string[] | undefined,
  limit = 40,
) {
  const take = Math.min(Math.max(limit, 1), 100);
  const or: Array<Record<string, unknown>> = [{ tenantId }];
  if (allowedCompanyIds?.length) {
    or.push({ companyId: { in: allowedCompanyIds } });
  }
  return prisma.backupJob.findMany({
    where: { OR: or },
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      company: { select: { id: true, nameAr: true, nameEn: true } },
    },
  });
}

export async function getBackupJob(
  prisma: PrismaService,
  tenantId: string,
  jobId: string,
  allowedCompanyIds: string[] | undefined,
) {
  const job = await prisma.backupJob.findFirst({
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

export async function getBackupRestoreReport(
  prisma: PrismaService,
  tenantId: string,
  jobId: string,
  allowedCompanyIds: string[] | undefined,
) {
  const job = await getBackupJob(prisma, tenantId, jobId, allowedCompanyIds);
  if (job.scope !== 'company_logical' || !job.localRelativePath) {
    return buildNonLogicalBackupRestoreReport(job);
  }
  try {
    return await buildCompanyLogicalRestoreReport(job);
  } catch {
    throw new BadRequestException('تعذر قراءة ملف النسخة');
  }
}

export async function loadParsedLogicalSnapshotForImport(
  prisma: PrismaService,
  tenantId: string,
  jobId: string,
  allowedCompanyIds: string[] | undefined,
): Promise<Record<string, unknown>> {
  const job = await getBackupJob(prisma, tenantId, jobId, allowedCompanyIds);
  if (job.scope !== 'company_logical' || !job.localRelativePath) {
    throw new BadRequestException('الاستيراد متاح لنسخ الشركة المنطقية فقط');
  }
  const parsed = await readGzippedJsonByBackupRelativePath(job.localRelativePath);
  assertSnapshotBelongsToTenant(parsed, tenantId);
  return parsed;
}

export async function resolveBackupJobDownloadPath(
  prisma: PrismaService,
  tenantId: string,
  jobId: string,
  allowedCompanyIds: string[] | undefined,
): Promise<{ absolutePath: string; filename: string }> {
  const job = await getBackupJob(prisma, tenantId, jobId, allowedCompanyIds);
  if (!job.localRelativePath) throw new BadRequestException('لا يوجد ملف للتنزيل');
  return resolveLocalBackupFileOrThrow(job.localRelativePath, `noorix-backup-${job.scope}-${job.id}.json.gz`);
}

export async function verifyCompanyLogicalBackupJob(
  prisma: PrismaService,
  tenantId: string,
  jobId: string,
  allowedCompanyIds: string[] | undefined,
) {
  const job = await getBackupJob(prisma, tenantId, jobId, allowedCompanyIds);
  if (job.scope !== 'company_logical' || !job.localRelativePath) {
    throw new BadRequestException('التحقق متاح لنسخ الشركة المكتملة فقط');
  }
  if (job.status !== 'completed') {
    throw new BadRequestException('التحقق متاح للنسخ المكتملة فقط');
  }
  const abs = path.join(getBackupRoot(), job.localRelativePath);
  try {
    await fs.access(abs);
  } catch {
    throw new NotFoundException('الملف غير موجود على الخادم');
  }
  return runManualCompanyLogicalJobVerify(prisma, { id: job.id }, abs);
}

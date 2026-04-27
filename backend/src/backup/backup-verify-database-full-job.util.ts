import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { getBackupRoot } from './backup-env-paths.util';
import { verifyPgCustomDumpGz } from './backup-file-helpers.util';
import { verifySystemFullTarGz } from './backup-system-full-restore.util';

export async function runVerifyDatabaseFullJob(
  prisma: PrismaService,
  jobId: string,
): Promise<{ ok: true; jobId: string }> {
  const job = await prisma.backupJob.findFirst({
    where: { id: jobId, scope: { in: ['database_full', 'system_full'] } },
  });
  if (!job) throw new NotFoundException('النسخة غير موجودة');
  if (job.status !== 'completed' || !job.localRelativePath) {
    throw new BadRequestException('التحقق متاح للنسخ المكتملة التي يوجد لها ملف');
  }
  const abs = path.join(getBackupRoot(), job.localRelativePath);
  try {
    await fs.access(abs);
  } catch {
    throw new NotFoundException('الملف غير موجود على الخادم');
  }
  const v =
    job.scope === 'system_full' ? await verifySystemFullTarGz(abs) : await verifyPgCustomDumpGz(abs);
  const now = new Date();
  await prisma.backupJob.update({
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

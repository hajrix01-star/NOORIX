import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { getBackupRoot } from './backup-env-paths.util';

export async function runResolveSystemFullJobDownloadPath(
  prisma: PrismaService,
  jobId: string,
): Promise<{ absolutePath: string; filename: string }> {
  const job = await prisma.backupJob.findFirst({
    where: { id: jobId, scope: { in: ['database_full', 'system_full'] } },
  });
  if (!job) throw new NotFoundException('النسخة غير موجودة');
  if (job.status !== 'completed' || !job.localRelativePath) {
    throw new BadRequestException('التنزيل متاح للنسخ المكتملة التي يوجد لها ملف');
  }
  const abs = path.join(getBackupRoot(), job.localRelativePath);
  try {
    await fs.access(abs);
  } catch {
    throw new NotFoundException('الملف غير موجود على الخادم');
  }
  const ord = job.ordinal != null ? String(job.ordinal) : 'na';
  const filename =
    job.scope === 'system_full'
      ? `noorix-system-archive-${ord}-${job.id}.tar.gz`
      : `noorix-full-db-${ord}-${job.id}.dump.gz`;
  return { absolutePath: abs, filename };
}

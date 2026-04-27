import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { readGzippedJsonFromAbsPath } from './backup-company-logical-snapshot-read.util';

/**
 * تحقق يدوي مرتبط بطلب واجهة: يقرأ ملف لقطة شركة ويتحقق من `noorix-company-logical` ويحدّث `backupJob`.
 */
export async function runManualCompanyLogicalJobVerify(
  prisma: PrismaService,
  job: { id: string },
  absPath: string,
): Promise<{ ok: true; jobId: string }> {
  const now = new Date();
  try {
    const snap = (await readGzippedJsonFromAbsPath(absPath)) as { meta?: { format?: string } };
    if (!snap?.meta || snap.meta.format !== 'noorix-company-logical') {
      throw new Error('تنسيق اللقطة غير صالح — المتوقع: noorix-company-logical');
    }
    await prisma.backupJob.update({
      where: { id: job.id },
      data: { verifyOk: true, verifyError: null, verifiedAt: now },
    });
    return { ok: true, jobId: job.id };
  } catch (e) {
    const msg = (e as Error).message;
    await prisma.backupJob.update({
      where: { id: job.id },
      data: { verifyOk: false, verifyError: msg, verifiedAt: now },
    });
    throw new BadRequestException(`ملف لقطة تالف أو غير صالح: ${msg}`);
  }
}

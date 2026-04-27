import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { PrismaService } from '../prisma/prisma.service';
import { getBackupRoot } from './backup-env-paths.util';

/**
 * تحقق تلقائي بعد نسخ شركة (تنسيق اللقطة) — لا يرمي للمجدول.
 */
export async function runAutoVerifyCompanyLogicalJob(
  prisma: PrismaService,
  jobId: string,
  onWarn: (message: string) => void,
): Promise<void> {
  const job = await prisma.backupJob.findUnique({ where: { id: jobId } });
  if (!job || job.scope !== 'company_logical' || !job.localRelativePath || job.status !== 'completed') return;
  const abs = path.join(getBackupRoot(), job.localRelativePath);
  const now = new Date();
  try {
    await fs.access(abs);
    const buf = await fs.readFile(abs);
    const json = zlib.gunzipSync(buf).toString('utf8');
    const snap = JSON.parse(json) as { meta?: { format?: string } };
    if (!snap?.meta || snap.meta.format !== 'noorix-company-logical') {
      throw new Error('تنسيق اللقطة غير صالح');
    }
    await prisma.backupJob.update({
      where: { id: job.id },
      data: { verifyOk: true, verifyError: null, verifiedAt: now },
    });
  } catch (e) {
    const msg = (e as Error).message;
    await prisma.backupJob.update({
      where: { id: job.id },
      data: { verifyOk: false, verifyError: msg, verifiedAt: now },
    });
    onWarn(`Company backup auto-verify failed ${jobId}: ${msg}`);
  }
}

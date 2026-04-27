import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { getBackupRoot } from './backup-env-paths.util';
import { assertBackupRestoreConfirmPhrase } from './backup-restore-confirm-phrase.util';
import { restoreDatabaseFullFromGzippedCustomDump } from './backup-restore-dump-gz.util';
import { applySystemFullTarRestore } from './backup-system-full-restore.util';

const MSG_SYSTEM_FULL_OK_AR =
  'تم استرداد القاعدة ودمج مجلد الرفع (uploads) إن وُجد في الأرشيف. أعد تشغيل خدمة الباكند إن لم يُعِد التشغيل تلقائياً.';
const MSG_SYSTEM_FULL_OK_EN =
  'Database and uploads (if present) restored. Restart the backend if it did not restart automatically.';
const MSG_DB_ONLY_OK_AR =
  'تم استرداد القاعدة (نسخة قاعدة فقط — بدون مجلد الرفع). أعد تشغيل خدمة الباكند إن لم يُعِد التشغيل تلقائياً.';
const MSG_DB_ONLY_OK_EN = 'Database-only backup restored (no uploads folder). Restart the backend if needed.';

export type RestoreOkPayload = {
  ok: boolean;
  messageAr: string;
  messageEn: string;
  exitAfter: boolean;
};

/**
 * استرداد أرشيف نظام مرفوع من الجهاز — يحذف الملف المؤقت بعد المحاولة.
 */
export async function runRestoreSystemFullFromUploadedTar(opts: {
  tempPath: string;
  confirmPhrase: string;
}): Promise<RestoreOkPayload> {
  assertBackupRestoreConfirmPhrase(opts.confirmPhrase);
  try {
    await fs.access(opts.tempPath);
  } catch {
    throw new BadRequestException('ملف الرفع غير موجود');
  }
  try {
    await applySystemFullTarRestore(opts.tempPath);
  } finally {
    await fs.unlink(opts.tempPath).catch(() => undefined);
  }
  const exitAfter = process.env.BACKUP_RESTORE_EXIT_AFTER === 'true';
  return {
    ok: true,
    messageAr: MSG_SYSTEM_FULL_OK_AR,
    messageEn: MSG_SYSTEM_FULL_OK_EN,
    exitAfter,
  };
}

/**
 * استرداد من نسخة مكتملة: ‎system_full (tar.gz) أو ‎database_full (dump.gz).
 */
export async function runRestoreFromBackupJobRecord(
  prisma: PrismaService,
  jobId: string,
  confirmPhrase: string,
): Promise<RestoreOkPayload> {
  assertBackupRestoreConfirmPhrase(confirmPhrase);
  const job = await prisma.backupJob.findFirst({
    where: { id: jobId, scope: { in: ['database_full', 'system_full'] } },
  });
  if (!job) throw new NotFoundException('النسخة غير موجودة');
  if (job.status !== 'completed' || !job.localRelativePath) {
    throw new BadRequestException('الاسترداد متاح للنسخ المكتملة التي يوجد لها ملف');
  }
  const absPath = path.join(getBackupRoot(), job.localRelativePath);
  try {
    await fs.access(absPath);
  } catch {
    throw new NotFoundException('الملف غير موجود على الخادم');
  }

  const exitAfter = process.env.BACKUP_RESTORE_EXIT_AFTER === 'true';

  if (job.scope === 'system_full') {
    await applySystemFullTarRestore(absPath);
    return {
      ok: true,
      messageAr: MSG_SYSTEM_FULL_OK_AR,
      messageEn: MSG_SYSTEM_FULL_OK_EN,
      exitAfter,
    };
  }

  await restoreDatabaseFullFromGzippedCustomDump(absPath);
  return {
    ok: true,
    messageAr: MSG_DB_ONLY_OK_AR,
    messageEn: MSG_DB_ONLY_OK_EN,
    exitAfter,
  };
}

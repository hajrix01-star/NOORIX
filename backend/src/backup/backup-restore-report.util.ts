import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getBackupRoot } from './backup-env-paths.util';
import { readGzippedJsonByBackupRelativePath } from './backup-company-logical-snapshot-read.util';

type BackupJobReportShape = {
  id: string;
  scope: string;
  localRelativePath: string | null;
  report: unknown;
  contentHash: string | null;
  sizeBytes: bigint | number | null;
};

/** عند scope ≠ company_logical أو بلا ملف لقطة محلي. */
export function buildNonLogicalBackupRestoreReport(job: BackupJobReportShape) {
  return {
    jobId: job.id,
    scope: job.scope,
    messageAr:
      job.scope === 'database_full' || job.scope === 'system_full'
        ? job.scope === 'system_full'
          ? 'أرشيف النظام (قاعدة + uploads) — الاسترجاع من الإعدادات ← النسخ الاحتياطي، أو رفع أرشيف من الجهاز، مع عبارة التأكيد.'
          : 'نسخة قاعدة قديمة (.dump.gz) — الاسترجاع من الإعدادات إن وُجدت في السجل، أو يدوياً بـ pg_restore.'
        : 'لا يوجد ملف لقطة لهذه المهمة.',
    messageEn: 'Full restore: Settings → Backup (owner), or ask your system administrator.',
    tables: job.report as Record<string, unknown> | null,
  };
}

export async function buildCompanyLogicalRestoreReport(
  job: Pick<BackupJobReportShape, 'id' | 'scope' | 'contentHash' | 'sizeBytes' | 'localRelativePath'>,
) {
  if (!job.localRelativePath) {
    throw new BadRequestException('لا يوجد ملف');
  }
  const snap = (await readGzippedJsonByBackupRelativePath(job.localRelativePath)) as {
    meta?: { format?: string; version?: number; exportedAt?: string; companyId?: string };
    counts?: Record<string, number>;
  };
  return {
    jobId: job.id,
    scope: job.scope,
    meta: snap.meta,
    counts: snap.counts,
    messageAr: 'تقرير استرجاع — راجع الأعدادات قبل الاستيراد في بيئة اختبار.',
    messageEn: 'Restore manifest — verify in a staging environment first.',
    integrity: { contentHash: job.contentHash, sizeBytes: job.sizeBytes?.toString?.() ?? String(job.sizeBytes) },
  };
}

/**
 * جاهز لمسار التنزيل: يتأكد من وجود الملف ويعيد المسار والاسم.
 */
export async function resolveLocalBackupFileOrThrow(
  localRelativePath: string,
  filename: string,
): Promise<{ absolutePath: string; filename: string }> {
  const abs = path.join(getBackupRoot(), localRelativePath);
  try {
    await fs.access(abs);
  } catch {
    throw new NotFoundException('الملف غير موجود على الخادم');
  }
  return { absolutePath: abs, filename };
}

import { PrismaService } from '../prisma/prisma.service';
import { parseDriveFolderId } from './backup-env-paths.util';

export const BACKUP_EXTERNAL_UPLOAD_DISABLED = true;

/**
 * إعدادات الرفع الخارجي من قاعدة البيانات (يُكمّل متغيرات البيئة).
 */
export async function resolveExternalUploadOpts(
  deps: {
    prisma: PrismaService;
    ensureSystemBackupConfigRow: () => Promise<{
      gdriveScriptUrl: string | null;
      gdriveFolderId: string | null;
    }>;
  },
  scope: string,
  companyId: string | null,
): Promise<{ scriptUrl: string | null; folderId: string | null }> {
  if (BACKUP_EXTERNAL_UPLOAD_DISABLED) {
    return { scriptUrl: null, folderId: null };
  }
  if (scope === 'database_full' || scope === 'system_full') {
    const c = await deps.ensureSystemBackupConfigRow();
    return {
      scriptUrl: c.gdriveScriptUrl?.trim() || null,
      folderId: parseDriveFolderId(c.gdriveFolderId),
    };
  }
  if (scope === 'company_logical' && companyId) {
    const c = await deps.prisma.companyBackupConfig.findUnique({
      where: { companyId },
      select: { gdriveScriptUrl: true, gdriveFolderId: true },
    });
    return {
      scriptUrl: c?.gdriveScriptUrl?.trim() || null,
      folderId: parseDriveFolderId(c?.gdriveFolderId),
    };
  }
  return { scriptUrl: null, folderId: null };
}

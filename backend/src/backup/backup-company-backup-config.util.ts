import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normOptionalTrimmedFolderId, normOptionalTrimmedUrl } from './backup-gdrive-field-normalize.util';

export type CompanyBackupConfigView = {
  companyId: string;
  enabled: boolean;
  scheduleHour: number;
  scheduleMinute: number;
  retentionCount: number;
  timezone: string;
  lastRunDayRiyadh: string | null;
  gdriveScriptUrl: string | null;
  gdriveFolderId: string | null;
};

export async function getCompanyBackupConfigView(
  prisma: PrismaService,
  tenantId: string,
  companyId: string,
): Promise<CompanyBackupConfigView> {
  const co = await prisma.company.findFirst({
    where: { id: companyId, tenantId },
    select: { id: true },
  });
  if (!co) throw new NotFoundException('الشركة غير موجودة');
  const row = await prisma.companyBackupConfig.findUnique({ where: { companyId } });
  if (!row) {
    return {
      companyId,
      enabled: false,
      scheduleHour: 6,
      scheduleMinute: 0,
      retentionCount: 5,
      timezone: 'Asia/Riyadh',
      lastRunDayRiyadh: null,
      gdriveScriptUrl: null,
      gdriveFolderId: null,
    };
  }
  return {
    companyId: row.companyId,
    enabled: row.enabled,
    scheduleHour: row.scheduleHour,
    scheduleMinute: row.scheduleMinute,
    retentionCount: row.retentionCount,
    timezone: row.timezone,
    lastRunDayRiyadh: row.lastRunDayRiyadh,
    gdriveScriptUrl: row.gdriveScriptUrl ?? null,
    gdriveFolderId: row.gdriveFolderId ?? null,
  };
}

export async function upsertCompanyBackupConfigView(
  prisma: PrismaService,
  tenantId: string,
  dto: {
    companyId: string;
    enabled?: boolean;
    scheduleHour?: number;
    scheduleMinute?: number;
    retentionCount?: number;
    timezone?: string;
    gdriveScriptUrl?: string;
    gdriveFolderId?: string;
  },
): Promise<CompanyBackupConfigView> {
  const co = await prisma.company.findFirst({
    where: { id: dto.companyId, tenantId },
    select: { id: true },
  });
  if (!co) throw new NotFoundException('الشركة غير موجودة');
  const existing = await prisma.companyBackupConfig.findUnique({ where: { companyId: dto.companyId } });
  const patch = {
    ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
    ...(dto.scheduleHour !== undefined ? { scheduleHour: Math.min(23, Math.max(0, dto.scheduleHour)) } : {}),
    ...(dto.scheduleMinute !== undefined ? { scheduleMinute: Math.min(59, Math.max(0, dto.scheduleMinute)) } : {}),
    ...(dto.retentionCount !== undefined
      ? { retentionCount: Math.min(50, Math.max(1, dto.retentionCount)) }
      : {}),
    ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
    ...(dto.gdriveScriptUrl !== undefined ? { gdriveScriptUrl: normOptionalTrimmedUrl(dto.gdriveScriptUrl) } : {}),
    ...(dto.gdriveFolderId !== undefined ? { gdriveFolderId: normOptionalTrimmedFolderId(dto.gdriveFolderId) } : {}),
  };
  const row = existing
    ? await prisma.companyBackupConfig.update({ where: { companyId: dto.companyId }, data: patch })
    : await prisma.companyBackupConfig.create({
        data: {
          tenantId,
          companyId: dto.companyId,
          enabled: dto.enabled ?? false,
          scheduleHour: dto.scheduleHour ?? 6,
          scheduleMinute: dto.scheduleMinute ?? 0,
          retentionCount: dto.retentionCount ?? 5,
          timezone: dto.timezone ?? 'Asia/Riyadh',
          gdriveScriptUrl: normOptionalTrimmedUrl(dto.gdriveScriptUrl) ?? null,
          gdriveFolderId: normOptionalTrimmedFolderId(dto.gdriveFolderId) ?? null,
        },
      });
  return {
    companyId: row.companyId,
    enabled: row.enabled,
    scheduleHour: row.scheduleHour,
    scheduleMinute: row.scheduleMinute,
    retentionCount: row.retentionCount,
    timezone: row.timezone,
    lastRunDayRiyadh: row.lastRunDayRiyadh,
    gdriveScriptUrl: row.gdriveScriptUrl ?? null,
    gdriveFolderId: row.gdriveFolderId ?? null,
  };
}

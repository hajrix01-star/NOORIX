import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { getBackupRoot } from './backup-env-paths.util';

export async function findDuplicateBackupJob(
  prisma: PrismaService,
  tenantId: string | null,
  companyId: string | null,
  scope: string,
  hash: string,
): Promise<{ id: string } | null> {
  return prisma.backupJob.findFirst({
    where: {
      scope,
      status: { in: ['completed', 'skipped_duplicate'] },
      contentHash: hash,
      ...(tenantId != null ? { tenantId } : { tenantId: null }),
      ...(companyId != null ? { companyId } : { companyId: null }),
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
}

export async function nextOrdinalCompanyLogical(
  prisma: PrismaService,
  tenantId: string,
  companyId: string,
): Promise<number> {
  const a = await prisma.backupJob.aggregate({
    where: { tenantId, companyId, scope: 'company_logical', ordinal: { not: null } },
    _max: { ordinal: true },
  });
  return (a._max.ordinal ?? 0) + 1;
}

export async function nextOrdinalSystemFull(prisma: PrismaService): Promise<number> {
  const a = await prisma.backupJob.aggregate({
    where: { scope: 'system_full', ordinal: { not: null } },
    _max: { ordinal: true },
  });
  return (a._max.ordinal ?? 0) + 1;
}

export async function pruneCompanyLogicalBackups(
  prisma: PrismaService,
  tenantId: string,
  companyId: string,
  retentionCount: number,
): Promise<void> {
  const keep = Math.min(Math.max(retentionCount, 1), 50);
  const root = getBackupRoot();
  const victims = await prisma.backupJob.findMany({
    where: {
      tenantId,
      companyId,
      scope: 'company_logical',
      status: 'completed',
      localRelativePath: { not: null },
    },
    orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
    skip: keep,
  });
  for (const j of victims) {
    if (j.localRelativePath) {
      await fs.unlink(path.join(root, j.localRelativePath)).catch(() => undefined);
      const dir = path.dirname(j.localRelativePath);
      const base = path.basename(j.localRelativePath, '.json.gz');
      const attRel = path.join(dir, `${base}.attachments.tar.gz`);
      await fs.unlink(path.join(root, attRel)).catch(() => undefined);
    }
    await prisma.backupJob.delete({ where: { id: j.id } }).catch(() => undefined);
  }
}

export async function pruneSystemFullArchiveJobs(
  prisma: PrismaService,
  retentionCount: number,
): Promise<void> {
  const keep = Math.min(Math.max(retentionCount, 1), 50);
  const root = getBackupRoot();
  const victims = await prisma.backupJob.findMany({
    where: {
      scope: 'system_full',
      status: 'completed',
      localRelativePath: { not: null },
    },
    orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
    skip: keep,
  });
  for (const j of victims) {
    if (j.localRelativePath) {
      await fs.unlink(path.join(root, j.localRelativePath)).catch(() => undefined);
    }
    await prisma.backupJob.delete({ where: { id: j.id } }).catch(() => undefined);
  }
}

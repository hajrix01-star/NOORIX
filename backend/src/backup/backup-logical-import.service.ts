/**
 * استيراد لقطة منطقية إلى شركة جديدة داخل نفس المستأجر — إعادة تعيين كل المعرفات.
 * لا يستورد سجل التدقيق ولا روابط user_companies القديمة (يُضاف المستخدم الحالي فقط).
 */
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { parseLogicalImportSnapshotHeader } from './backup-logical-import-snapshot-header.util';
import { runBackupLogicalImportInTransaction } from './backup-logical-import-transaction.util';

@Injectable()
export class BackupLogicalImportService {
  private readonly logger = new Logger(BackupLogicalImportService.name);

  constructor(private readonly prisma: PrismaService) {}

  private nid() {
    return randomUUID();
  }

  async importIntoNewCompany(params: {
    snapshot: { meta?: Record<string, unknown>; data?: Record<string, unknown>; counts?: Record<string, number> };
    tenantId: string;
    nameAr: string;
    nameEn?: string | null;
    importingUserId: string;
    /** أو عبر البيئة BACKUP_LOGICAL_IMPORT_FAIL_ON_ALLOCATION_WARNINGS=1 */
    failOnAllocationWarnings?: boolean;
  }): Promise<{
    newCompanyId: string;
    nameAr: string;
    nameEn: string | null;
    summary: {
      importedAt: string;
      sourceMeta: Record<string, unknown>;
      counts: Record<string, number>;
      totalRecords: number;
      importWarnings?: string[];
    };
  }> {
    const { snapshot, tenantId, nameAr, nameEn, importingUserId } = params;
    const { data, counts, totalRecords, sourceMeta } = parseLogicalImportSnapshotHeader({
      snapshot,
      tenantId,
    });

    const newCompanyId = this.nid();
    const co = data.company as Record<string, unknown> | undefined;
    if (!co) throw new BadRequestException('بيانات الشركة مفقودة في اللقطة');

    const resolvedNameEn = nameEn ?? (co.nameEn as string | null) ?? null;

    const strictAlloc =
      params.failOnAllocationWarnings === true ||
      process.env.BACKUP_LOGICAL_IMPORT_FAIL_ON_ALLOCATION_WARNINGS === '1';

    const allocationWarnings = await this.prisma.$transaction(
      (tx) =>
        runBackupLogicalImportInTransaction(tx, {
          tenantId,
          newCompanyId,
          data,
          nameAr,
          resolvedNameEn,
          importingUserId,
          co,
          strictAlloc,
          logger: this.logger,
          nid: () => this.nid(),
        }),
      { maxWait: 120000, timeout: 600000 },
    );
    return {
      newCompanyId,
      nameAr,
      nameEn: resolvedNameEn,
      summary: {
        importedAt: new Date().toISOString(),
        sourceMeta,
        counts,
        totalRecords,
        importWarnings: allocationWarnings.length > 0 ? allocationWarnings : undefined,
      },
    };
  }
}

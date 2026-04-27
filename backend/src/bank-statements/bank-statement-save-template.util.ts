import { Logger } from '@nestjs/common';
import type { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { columnMappingToTemplateColumns, type TemplateColumnsJson } from './bank-template-columns.util';
import type { ColumnMapping } from './bank-statements-header-heuristic.util';

export async function trySaveBankStatementTemplateAfterConfirm(
  prisma: TenantPrismaService,
  logger: Logger,
  params: {
    tenantId: string;
    companyId: string;
    dto: {
      companyName: string;
      bankName: string;
      headerRow: number;
      dataStartRow: number;
      dataEndRow: number;
      columnMapping: ColumnMapping;
    };
    raw: string[][];
  },
): Promise<void> {
  const { tenantId, companyId, dto, raw } = params;
  const headers = raw[dto.headerRow]?.map((h) => String(h || '').trim()).filter(Boolean) || [];
  if (headers.length < 2) return;
  const cols = columnMappingToTemplateColumns(dto.columnMapping);
  if (Object.keys(cols).length < 2) return;
  try {
    await prisma.bankStatementTemplate.create({
      data: {
        tenantId,
        companyId,
        bankName: (dto.bankName || 'غير محدد').slice(0, 200),
        customerName: (dto.companyName || '').slice(0, 200) || null,
        headerRow: dto.headerRow,
        dataStartRow: dto.dataStartRow,
        dataEndRow: dto.dataEndRow,
        columnsJson: cols as object,
        dateFormat: 'auto',
        sampleHeaders: headers.slice(0, 24) as object,
        isActive: true,
        usageCount: 1,
        lastUsedAt: new Date(),
      },
    });
  } catch (e) {
    logger.warn(`saveTemplateAfterConfirm: ${(e as Error).message}`);
  }
}

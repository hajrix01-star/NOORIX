import { BadRequestException } from '@nestjs/common';

export type LogicalImportSnapshotHeader = {
  meta: Record<string, unknown>;
  data: Record<string, unknown>;
  counts: Record<string, number>;
  totalRecords: number;
  sourceMeta: Record<string, unknown>;
};

/**
 * يتحقق من صلاحية لقطة الاستيراد ويحسب العدّادات.
 */
export function parseLogicalImportSnapshotHeader(params: {
  snapshot: { meta?: Record<string, unknown>; data?: Record<string, unknown>; counts?: Record<string, number> };
  tenantId: string;
}): LogicalImportSnapshotHeader {
  const { snapshot, tenantId } = params;
  const meta = snapshot.meta;
  const data = snapshot.data;
  if (!meta || meta.format !== 'noorix-company-logical' || !data) {
    throw new BadRequestException('ملف لقطة غير صالح');
  }
  if (String(meta.tenantId) !== tenantId) {
    throw new BadRequestException('اللقطة لا تنتمي لهذا المستأجر');
  }

  const countsRaw = snapshot.counts;
  const counts: Record<string, number> =
    countsRaw && typeof countsRaw === 'object'
      ? Object.fromEntries(
          Object.entries(countsRaw).map(([k, v]) => [k, typeof v === 'number' ? v : Number(v) || 0]),
        )
      : {};
  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);
  const sourceMeta: Record<string, unknown> = meta
    ? {
        exportedAt: meta.exportedAt,
        version: meta.version,
        originalCompanyId: meta.companyId,
        format: meta.format,
      }
    : {};
  return { meta, data, counts, totalRecords, sourceMeta };
}

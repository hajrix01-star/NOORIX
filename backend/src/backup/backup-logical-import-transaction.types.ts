import { Logger } from '@nestjs/common';

export type BackupLogicalImportTxParams = {
  tenantId: string;
  newCompanyId: string;
  data: Record<string, unknown>;
  counts: Record<string, number>;
  nameAr: string;
  resolvedNameEn: string | null;
  importingUserId: string;
  co: Record<string, unknown>;
  strictAlloc: boolean;
  logger: Logger;
  nid: () => string;
};

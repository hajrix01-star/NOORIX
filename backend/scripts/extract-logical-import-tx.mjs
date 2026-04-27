import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, '../src/backup/backup-logical-import.service.ts');
const s = fs.readFileSync(p, 'utf8');
const lines = s.split(/\r?\n/);
const start = lines.findIndex((l) => l.includes('async (tx) => {'));
const maxWaitIdx = lines.findIndex((l) => l.includes('{ maxWait: 120000'));
if (start < 0 || maxWaitIdx < 0) {
  console.error('markers not found', { start, maxWaitIdx });
  process.exit(1);
}
const bodyStart = start + 1;
const bodyEnd = maxWaitIdx;
const inner = lines.slice(bodyStart, bodyEnd).join('\n');
const replaced = inner
  .replace(/this\.nid\(\)/g, 'nid()')
  .replace(/this\.logger/g, 'logger');

const header = `import { BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  importSnapshotArr as arr,
  importSnapshotDec as dec,
  importSnapshotDdate as ddate,
} from './backup-logical-import-helpers.util';
import { verifyImportedCompanyVaultAllocations } from './backup-logical-import-verify-allocations.util';

export type BackupLogicalImportTxParams = {
  tenantId: string;
  newCompanyId: string;
  data: Record<string, unknown>;
  nameAr: string;
  resolvedNameEn: string | null;
  importingUserId: string;
  co: Record<string, unknown>;
  strictAlloc: boolean;
  logger: Logger;
  nid: () => string;
};

/**
 * جسم الاستيراد المنطقي داخل \\$transaction — نفس التسلسل والخرائط.
 */
export async function runBackupLogicalImportInTransaction(
  tx: Prisma.TransactionClient,
  p: BackupLogicalImportTxParams,
): Promise<string[]> {
  const { tenantId, newCompanyId, data, nameAr, resolvedNameEn, importingUserId, co, strictAlloc, logger, nid } = p;
  let allocationWarnings: string[] = [];
`;

const footer = `
  return allocationWarnings;
}
`;

const out = path.join(__dirname, '../src/backup/backup-logical-import-transaction.util.ts');
fs.writeFileSync(out, header + replaced + footer);
console.log('wrote', out, 'body lines', bodyEnd - bodyStart);

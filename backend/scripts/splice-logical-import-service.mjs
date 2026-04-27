import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, '../src/backup/backup-logical-import.service.ts');
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
const head = lines.slice(0, 62).join('\n');
const tail = lines.slice(889).join('\n');
const mid = `    const allocationWarnings = await this.prisma.$transaction(
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
    );`;
fs.writeFileSync(p, `${head}\n${mid}\n${tail}`);
console.log('spliced', { headEnd: 62, tailStart: 890, n: lines.length });

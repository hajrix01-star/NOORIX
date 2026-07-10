import { BadRequestException } from '@nestjs/common';
import { Client } from 'pg';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { parseDatabaseUrl } from './backup-database-url.util';

export type BackupTableFingerprint = {
  table: string;
  rowCount: number;
  checksum: string;
};

export type BackupDatabaseFingerprint = {
  capturedAt: string;
  database: string;
  tables: BackupTableFingerprint[];
  totalRows: number;
  tableCount: number;
};

export type BackupParityReport = {
  ok: boolean;
  checkedAt: string;
  sourceTableCount: number;
  restoredTableCount: number;
  sourceTotalRows: number;
  restoredTotalRows: number;
  mismatches: string[];
};

function backupVerificationDatabaseUrl(): string {
  const dbUrl = process.env.BACKUP_VERIFY_DATABASE_URL || process.env.BACKUP_DATABASE_URL || process.env.DATABASE_URL;
  if (!dbUrl) throw new BadRequestException('DATABASE_URL is not configured');
  return dbUrl.split('?')[0];
}

function adminDatabaseUrl(dbUrl: string): string {
  return dbUrl.replace(/\/([^/?]+)(\?|$)/, '/postgres$2');
}

function quotePgIdent(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function getPublicTableNames(client: Client): Promise<string[]> {
  const res = await client.query<{ table_name: string }>(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `,
  );
  return res.rows.map((row) => row.table_name);
}

async function fingerprintTable(client: Client, table: string): Promise<BackupTableFingerprint> {
  const tableIdent = quotePgIdent(table);
  const res = await client.query<{ row_count: string; checksum: string }>(`
    WITH row_hashes AS (
      SELECT MD5(TO_JSONB(t)::text) AS row_hash
      FROM public.${tableIdent} AS t
    ),
    aggregates AS (
      SELECT
        COUNT(*)::text AS row_count,
        COALESCE(SUM(('x' || SUBSTRING(row_hash, 1, 16))::bit(64)::bigint::numeric), 0)::text AS checksum_a,
        COALESCE(SUM(('x' || SUBSTRING(row_hash, 17, 16))::bit(64)::bigint::numeric), 0)::text AS checksum_b
      FROM row_hashes
    )
    SELECT
      row_count,
      MD5(row_count || ':' || checksum_a || ':' || checksum_b) AS checksum
    FROM aggregates
  `);
  const row = res.rows[0];
  return {
    table,
    rowCount: Number(row?.row_count ?? 0),
    checksum: row?.checksum ?? '',
  };
}

async function buildDatabaseFingerprintForUrl(dbUrl: string): Promise<BackupDatabaseFingerprint> {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    const parsed = parseDatabaseUrl(dbUrl);
    const tableNames = await getPublicTableNames(client);
    const tables: BackupTableFingerprint[] = [];
    for (const table of tableNames) {
      tables.push(await fingerprintTable(client, table));
    }
    const totalRows = tables.reduce((sum, table) => sum + table.rowCount, 0);
    return {
      capturedAt: new Date().toISOString(),
      database: parsed.database,
      tables,
      totalRows,
      tableCount: tables.length,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function buildSourceDatabaseFingerprint(): Promise<BackupDatabaseFingerprint> {
  return buildDatabaseFingerprintForUrl(backupVerificationDatabaseUrl());
}

function replaceDatabaseName(dbUrl: string, database: string): string {
  const parsed = parseDatabaseUrl(dbUrl);
  const encodedDatabase = encodeURIComponent(database);
  const pathPart = `/${encodedDatabase}`;
  const url = new URL(dbUrl.replace(/^postgresql:/i, 'http:'));
  url.pathname = pathPart;
  const scheme = dbUrl.startsWith('postgresql:') ? 'postgresql:' : 'postgres:';
  return `${scheme}//${encodeURIComponent(parsed.user)}:${encodeURIComponent(parsed.password)}@${parsed.host}:${parsed.port}${pathPart}`;
}

async function createTempDatabase(adminUrl: string, dbName: string): Promise<void> {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${quotePgIdent(dbName)}`);
  } finally {
    await admin.end().catch(() => undefined);
  }
}

async function dropTempDatabase(adminUrl: string, dbName: string): Promise<void> {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await admin.query(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [dbName],
    );
    await admin.query(`DROP DATABASE IF EXISTS ${quotePgIdent(dbName)}`);
  } finally {
    await admin.end().catch(() => undefined);
  }
}

async function extractDbDump(archiveAbs: string, destDir: string): Promise<string> {
  await fs.mkdir(destDir, { recursive: true });
  await new Promise<void>((resolve, reject) => {
    const child = spawn('tar', ['-xzf', archiveAbs, '-C', destDir, '--no-absolute-names', 'db.dump'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let err = '';
    child.stderr?.on('data', (c) => {
      err += String(c);
    });
    child.on('error', (e) => reject(new BadRequestException(`Unable to extract db.dump: ${(e as Error).message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new BadRequestException(`Unable to extract db.dump: ${err || 'exit code ' + code}`));
    });
  });
  return path.join(destDir, 'db.dump');
}

async function restoreDumpToTempDatabase(dumpPath: string, dbUrl: string): Promise<void> {
  const parsed = parseDatabaseUrl(dbUrl);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      'pg_restore',
      ['--no-owner', '--no-acl', '-h', parsed.host, '-p', parsed.port, '-U', parsed.user, '-d', parsed.database, dumpPath],
      {
        env: {
          ...process.env,
          PGPASSWORD: parsed.password,
          PGSSLMODE: parsed.host === 'localhost' || parsed.host === '127.0.0.1' ? 'disable' : 'require',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let err = '';
    child.stderr?.on('data', (c) => {
      err += String(c);
    });
    child.on('error', (e) => reject(new BadRequestException(`Unable to run pg_restore: ${(e as Error).message}`)));
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new BadRequestException(`Temp restore failed: ${err || 'exit code ' + code}`));
    });
  });
}

function compareFingerprints(
  source: BackupDatabaseFingerprint,
  restored: BackupDatabaseFingerprint,
): BackupParityReport {
  const restoredByTable = new Map(restored.tables.map((table) => [table.table, table]));
  const sourceByTable = new Map(source.tables.map((table) => [table.table, table]));
  const mismatches: string[] = [];

  for (const sourceTable of source.tables) {
    const restoredTable = restoredByTable.get(sourceTable.table);
    if (!restoredTable) {
      mismatches.push(`Missing restored table: ${sourceTable.table}`);
      continue;
    }
    if (restoredTable.rowCount !== sourceTable.rowCount) {
      mismatches.push(
        `Row count mismatch in ${sourceTable.table}: source=${sourceTable.rowCount}, restored=${restoredTable.rowCount}`,
      );
    }
    if (restoredTable.checksum !== sourceTable.checksum) {
      mismatches.push(`Checksum mismatch in ${sourceTable.table}`);
    }
  }

  for (const restoredTable of restored.tables) {
    if (!sourceByTable.has(restoredTable.table)) {
      mismatches.push(`Unexpected restored table: ${restoredTable.table}`);
    }
  }

  return {
    ok: mismatches.length === 0,
    checkedAt: new Date().toISOString(),
    sourceTableCount: source.tableCount,
    restoredTableCount: restored.tableCount,
    sourceTotalRows: source.totalRows,
    restoredTotalRows: restored.totalRows,
    mismatches,
  };
}

export async function verifySystemFullArchiveDataParity(
  archiveAbs: string,
  sourceFingerprint: BackupDatabaseFingerprint,
): Promise<BackupParityReport> {
  const sourceDbUrl = backupVerificationDatabaseUrl();
  const tempDbName = `noorix_verify_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const tempDbUrl = replaceDatabaseName(sourceDbUrl, tempDbName);
  const adminUrl = adminDatabaseUrl(sourceDbUrl);
  const tmpBase = await fs.mkdtemp(path.join(os.tmpdir(), 'noorix-parity-'));

  await createTempDatabase(adminUrl, tempDbName);
  try {
    const dumpPath = await extractDbDump(archiveAbs, tmpBase);
    await restoreDumpToTempDatabase(dumpPath, tempDbUrl);
    const restoredFingerprint = await buildDatabaseFingerprintForUrl(tempDbUrl);
    return compareFingerprints(sourceFingerprint, restoredFingerprint);
  } finally {
    await fs.rm(tmpBase, { recursive: true, force: true }).catch(() => undefined);
    await dropTempDatabase(adminUrl, tempDbName).catch(() => undefined);
  }
}

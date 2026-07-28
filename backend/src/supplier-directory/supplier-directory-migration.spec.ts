import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260728193000_add_supplier_directory/migration.sql',
);
const rollbackPath = resolve(
  process.cwd(),
  'prisma/rollback/20260728193000_add_supplier_directory.sql',
);

describe('supplier directory migration safety', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  const rollback = readFileSync(rollbackPath, 'utf8');

  it('is additive for historical suppliers and invoices', () => {
    expect(migration).not.toMatch(/\bUPDATE\s+"suppliers"/i);
    expect(migration).not.toMatch(/\bUPDATE\s+"invoices"/i);
    expect(migration).not.toMatch(/\bDELETE\s+FROM/i);
    expect(migration).toContain('ADD COLUMN "directory_entry_id"');
  });

  it('adds only the approved category codes and protects SHAMI TAX', () => {
    expect(migration).toContain("'E2-8'");
    expect(migration).toContain("'E2-10'");
    expect(migration).toContain("'E2-11'");
    expect(migration).not.toContain("'E2-9'");
    expect(migration).toContain("'SHAMITAX'");
  });

  it('ships a rollback that removes links before dropping the catalog', () => {
    const clearLinksAt = rollback.indexOf('UPDATE "suppliers"');
    const dropCatalogAt = rollback.indexOf('DROP TABLE IF EXISTS "supplier_directory_entries"');
    expect(clearLinksAt).toBeGreaterThanOrEqual(0);
    expect(dropCatalogAt).toBeGreaterThan(clearLinksAt);
    expect(rollback).toContain('E2-8 may predate this release');
  });
});

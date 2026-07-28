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
const hrCategoriesMigrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260728230000_add_employee_service_categories/migration.sql',
);
const hrCategoriesRollbackPath = resolve(
  process.cwd(),
  'prisma/rollback/20260728230000_add_employee_service_categories.sql',
);

describe('supplier directory migration safety', () => {
  const migration = readFileSync(migrationPath, 'utf8');
  const rollback = readFileSync(rollbackPath, 'utf8');
  const hrCategoriesMigration = readFileSync(hrCategoriesMigrationPath, 'utf8');
  const hrCategoriesRollback = readFileSync(hrCategoriesRollbackPath, 'utf8');

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

  it('adds employee ticket and medical categories without mutating history or SHAMI TAX', () => {
    expect(hrCategoriesMigration).toContain("'E4-1'");
    expect(hrCategoriesMigration).toContain("'E4-2'");
    expect(hrCategoriesMigration).toContain("'SHAMITAX'");
    expect(hrCategoriesMigration).not.toMatch(/\bUPDATE\s+"suppliers"/i);
    expect(hrCategoriesMigration).not.toMatch(/\bUPDATE\s+"invoices"/i);
    expect(hrCategoriesMigration).not.toMatch(/\bDELETE\s+FROM/i);
  });

  it('rolls employee categories back only while they are unreferenced', () => {
    expect(hrCategoriesRollback).toContain('"supplier_category_id"');
    expect(hrCategoriesRollback).toContain('"expense_lines"');
    expect(hrCategoriesRollback).toContain('"invoices"');
    expect(hrCategoriesRollback).toContain('"parent_id"');
  });
});

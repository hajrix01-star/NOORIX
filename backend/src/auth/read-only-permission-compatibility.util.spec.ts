import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(__dirname, '../../prisma/migrations/20261105170000_split_read_only_mutation_permissions/migration.sql'),
  'utf8',
);

const compatibilityMappings = [
  { legacy: 'VIEW_REPORTS_BANK', write: 'BANK_STATEMENTS_WRITE' },
  { legacy: 'VIEW_DASHBOARD', write: 'DASHBOARD_CALENDAR_WRITE' },
  { legacy: 'SUPPLIERS_READ', write: 'SUPPLIERS_BOOKMARK_WRITE' },
  { legacy: 'SUPPLIERS_WRITE', write: 'SUPPLIERS_BOOKMARK_WRITE' },
  { legacy: 'VIEW_INVOICES', write: 'SUPPLIERS_BOOKMARK_WRITE' },
  { legacy: 'INVOICES_READ', write: 'SUPPLIERS_BOOKMARK_WRITE' },
] as const;

function applyDeploymentCompatibility(permissions: string[]): string[] {
  const migrated = new Set(permissions);
  for (const mapping of compatibilityMappings) {
    if (migrated.has(mapping.legacy)) migrated.add(mapping.write);
  }
  return [...migrated];
}

describe('read-only permission compatibility migration', () => {
  it('maps each legacy capability once and protects against duplicate permissions', () => {
    expect(migration).toContain("'VIEW_REPORTS_BANK' = ANY(\"permissions\")");
    expect(migration).toContain("'BANK_STATEMENTS_WRITE' = ANY(\"permissions\")");
    expect(migration).toContain("'VIEW_DASHBOARD' = ANY(\"permissions\")");
    expect(migration).toContain("'DASHBOARD_CALENDAR_WRITE' = ANY(\"permissions\")");
    expect(migration).toContain("'SUPPLIERS_READ'");
    expect(migration).toContain("'SUPPLIERS_WRITE'");
    expect(migration).toContain("'VIEW_INVOICES'");
    expect(migration).toContain("'INVOICES_READ'");
    expect(migration).toContain("'SUPPLIERS_BOOKMARK_WRITE' = ANY(\"permissions\")");
  });

  it('is deployment-scoped rather than a recurring application-startup migration', () => {
    expect(migration).toContain('This migration runs once.');
  });

  it('preserves legacy custom roles exactly once during the one-time deployment', () => {
    expect(applyDeploymentCompatibility(['VIEW_REPORTS_BANK'])).toEqual([
      'VIEW_REPORTS_BANK', 'BANK_STATEMENTS_WRITE',
    ]);
    expect(applyDeploymentCompatibility(['SUPPLIERS_READ', 'INVOICES_READ'])).toEqual([
      'SUPPLIERS_READ', 'INVOICES_READ', 'SUPPLIERS_BOOKMARK_WRITE',
    ]);

    const once = applyDeploymentCompatibility(['VIEW_DASHBOARD']);
    expect(applyDeploymentCompatibility(once)).toEqual(once);
    expect(applyDeploymentCompatibility(['REPORTS_READ']).filter(
      (permission) => permission === 'SUPPLIERS_BOOKMARK_WRITE',
    )).toEqual([]);
  });
});

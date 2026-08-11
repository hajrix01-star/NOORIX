import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('employee services accounting migration', () => {
  const migration = readFileSync(resolve(
    __dirname,
    '../../prisma/migrations/20260812143000_separate_employee_services_from_payroll/migration.sql',
  ), 'utf8');

  it('separates employee services from payroll for existing companies without changing amounts', () => {
    expect(migration).toContain("'EXP-009'");
    expect(migration).toContain("'E9-1'");
    expect(migration).toContain("'E9-2'");
    expect(migration).toContain("'E9-3'");
    expect(migration).toContain("'GOV-GOSI'");
    expect(migration).toContain('Move the existing category records rather than replacing them');
    expect(migration).not.toMatch(/UPDATE\s+"ledger_entries"/i);
    expect(migration).not.toMatch(/UPDATE\s+"invoices"/i);
  });
});

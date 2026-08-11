import * as fs from 'fs';
import * as path from 'path';

describe('payroll advance settlement register migration', () => {
  const sql = fs.readFileSync(path.resolve(
    __dirname,
    '../../prisma/migrations/20260811230000_add_payroll_advance_settlement_register/migration.sql',
  ), 'utf8');

  it('adds enforced tenant isolation and active-source idempotency', () => {
    expect(sql).toContain('CREATE TABLE "payroll_advance_settlements"');
    expect(sql).toContain('FORCE ROW LEVEL SECURITY');
    expect(sql).toContain('"payroll_advance_settlements_active_source_key"');
    expect(sql).toContain('WHERE "reversal_of_id" IS NULL');
  });

  it('does not rewrite any historical payroll, deduction, invoice, or ledger row', () => {
    expect(sql).not.toMatch(/INSERT\s+INTO\s+"(?:payroll_runs|employee_deductions|invoices|ledger_entries)"/i);
    expect(sql).not.toMatch(/UPDATE\s+"(?:payroll_runs|employee_deductions|invoices|ledger_entries)"/i);
    expect(sql).not.toMatch(/DELETE\s+FROM\s+"(?:payroll_runs|employee_deductions|invoices|ledger_entries)"/i);
  });
});

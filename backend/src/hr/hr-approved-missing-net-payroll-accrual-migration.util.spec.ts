import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('approved missing net-payroll accrual repair migration', () => {
  const sql = readFileSync(
    join(__dirname, '../../prisma/migrations/20260912130000_repair_approved_missing_net_payroll_accrual/migration.sql'),
    'utf8',
  );

  it('is an exact, single-run transaction protected by accounting preconditions', () => {
    expect(sql).toContain("c.\"name_ar\" = 'وقت الكرك'");
    expect(sql).toContain("pr.\"run_number\" = 'PR-2605-001'");
    expect(sql).toContain('APPROVED_MISSING_NET_PAYROLL_ACCRUAL_TARGET_MISMATCH');
    expect(sql).toContain("PERFORM set_config('app.current_tenant_id', v_run.\"tenant_id\", true)");
    expect(sql).toContain("pg_advisory_xact_lock(hashtext('payroll-accrual:'");
    expect(sql).toContain('APPROVED_MISSING_NET_PAYROLL_ACCRUAL_FISCAL_PERIOD_NOT_OPEN');
    expect(sql).toContain('APPROVED_MISSING_NET_PAYROLL_ACCRUAL_ADVANCE_EVIDENCE_MISMATCH');
    expect(sql).toContain('APPROVED_MISSING_NET_PAYROLL_ACCRUAL_ALREADY_POSTED');
    expect(sql).toMatch(/BEGIN;[\s\S]*COMMIT;\s*$/);
  });

  it('posts only the approved net payable and verifies it before marking the run accrued', () => {
    expect(sql).toContain("'payroll_accrual'");
    expect(sql).toContain("'EXP-004'");
    expect(sql).toContain("'PAY-001'");
    expect(sql).toContain("'operating_payroll'");
    expect(sql).toContain("md5('payroll-accrual-repair-v1:' || pri.\"id\")");
    expect(sql).toContain('APPROVED_MISSING_NET_PAYROLL_ACCRUAL_POSTCONDITION_FAILED');
    expect(sql).toContain("SET \"payroll_accrued_at\" = COALESCE(\"payroll_accrued_at\", NOW())");
    expect(sql).toContain("md5('audit:payroll-accrual-repair-v1:' || v_run.\"id\")");
  });

  it('does not create cash, vault, invoice, or advance mutations', () => {
    expect(sql).not.toContain('INSERT INTO "vault_transactions"');
    expect(sql).not.toContain('UPDATE "vaults"');
    expect(sql).not.toContain('UPDATE "invoices"');
    expect(sql).not.toContain('INSERT INTO "invoices"');
    expect(sql).not.toContain('INSERT INTO "employee_deductions"');
    expect(sql).not.toContain('UPDATE "employee_deductions"');
  });
});

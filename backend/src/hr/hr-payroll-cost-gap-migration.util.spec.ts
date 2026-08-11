import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('historical payroll cost-gap reconciliation migration', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/20260811123000_reconcile_historical_payroll_cost_gap/migration.sql',
    ),
    'utf8',
  );

  it('keeps all temporary-table work inside one explicit transaction', () => {
    expect(sql).toMatch(/BEGIN;[\s\S]*CREATE TEMP TABLE "_payroll_cost_gap_paid_runs"/);
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
  });
  it('uses the authoritative payroll equation for paid runs with legacy invoice links', () => {
    expect(sql).toContain(
      'pri."gross_salary" + pri."allowances_add" - pri."deductions" - pri."net_salary"',
    );
    expect(sql).toContain('pri."advances_deduct"');
    expect(sql).toContain('i."batch_id" = pr."id"');
    expect(sql).toContain("i.\"invoice_number\" = 'SAL-' || pr.\"run_number\"");
    expect(sql).toContain("STRPOS(COALESCE(i.\"notes\", ''), pr.\"run_number\") > 0");
    expect(sql).toContain('salary_invoice."transaction_date" AS "settlement_date"');
  });

  it('subtracts posted settlements and creates one audited non-cash item gap', () => {
    expect(sql).toContain('e."expected_amount" - p."posted_amount" AS "missing_amount"');
    expect(sql).toContain("md5('payroll-advance-reconcile:' || c.\"payroll_item_id\")");
    expect(sql).toContain("md5('advance-settlement:' || d.\"id\")");
    expect(sql).toContain("'operating_payroll'");
    expect(sql).toContain('ON CONFLICT ("id") DO NOTHING');
    expect(sql).toContain('PAYROLL_COST_GAP_RECONCILIATION_INCOMPLETE');
    expect(sql).not.toContain('UPDATE "invoices"');
  });

  it('marks only paid runs as reconciled to prevent a later duplicate replay', () => {
    expect(sql).toContain('FROM "_payroll_cost_gap_paid_runs" paid');
    expect(sql).toContain(
      'SET "advance_settlements_applied_at" = COALESCE(pr."advance_settlements_applied_at", NOW())',
    );
  });
});

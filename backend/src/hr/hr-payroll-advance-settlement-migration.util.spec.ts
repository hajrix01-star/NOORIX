import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('historical payroll advance settlement migration', () => {
  const sql = readFileSync(
    join(
      __dirname,
      '../../prisma/migrations/20260811100000_reconcile_historical_payroll_advance_settlements/migration.sql',
    ),
    'utf8',
  );

  it('posts only the missing non-cash payroll settlement with deterministic ids', () => {
    expect(sql).toContain("md5('advance-settlement:' || d.\"id\")");
    expect(sql).toContain("md5('payroll-advance-reconcile:' || m.\"payroll_item_id\")");
    expect(sql).toContain("'advance_settlement'");
    expect(sql).toContain("'operating_payroll'");
    expect(sql).toContain('ON CONFLICT ("id") DO NOTHING');
  });

  it('uses the paid salary date and fails closed on any remaining mismatch', () => {
    expect(sql).toContain('salary_invoice."transaction_date" AS "settlement_date"');
    expect(sql).toContain('ABS(c."expected_amount" - totals."posted_amount") > 0.01');
    expect(sql).toContain('PAYROLL_ADVANCE_SETTLEMENT_BACKFILL_INCOMPLETE');
  });
});
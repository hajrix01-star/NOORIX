-- Repair only the remaining, provable historical payroll cost gaps.
--
-- Some legacy advance deductions were saved by the first reconciliation
-- migration without their matching ledger entry.  A payroll advance reduces
-- cash paid, never the employee's salary cost.  This migration adds a
-- non-cash Dr EXP-004 / Cr ADV-001 correction for the missing amount only.
-- It never edits invoices, vaults, prior ledger rows, or a payroll amount.

BEGIN;

CREATE TEMP TABLE "_remaining_payroll_cost_gaps" ON COMMIT DROP AS
WITH paid_runs AS (
  SELECT
    pr."id" AS "payroll_run_id",
    pr."tenant_id",
    pr."company_id",
    pr."run_number",
    MIN(i."transaction_date") AS "settlement_date"
  FROM "payroll_runs" pr
  JOIN "invoices" i
    ON i."company_id" = pr."company_id"
   AND i."kind" = 'salary'
   AND i."status" = 'active'
   AND (
     i."batch_id" = pr."id"
     OR i."invoice_number" = 'SAL-' || pr."run_number"
     OR STRPOS(COALESCE(i."notes", ''), pr."run_number") > 0
   )
  WHERE pr."status" = 'completed'
  GROUP BY pr."id", pr."tenant_id", pr."company_id", pr."run_number"
), expected AS (
  SELECT
    pri."id" AS "payroll_item_id",
    paid."payroll_run_id",
    paid."tenant_id",
    paid."company_id",
    paid."run_number",
    pri."employee_id",
    paid."settlement_date",
    GREATEST(
      pri."advances_deduct",
      pri."gross_salary" + pri."allowances_add" - pri."deductions" - pri."net_salary",
      0
    ) AS "expected_settlement"
  FROM paid_runs paid
  JOIN "payroll_run_items" pri ON pri."payroll_run_id" = paid."payroll_run_id"
), posted AS (
  SELECT
    e."payroll_item_id",
    COALESCE(SUM(le."amount") FILTER (WHERE le."status" = 'active'), 0) AS "posted_settlement"
  FROM expected e
  LEFT JOIN "employee_deductions" d
    ON d."company_id" = e."company_id"
   AND d."employee_id" = e."employee_id"
   AND d."deduction_type" = 'advance'
   AND STRPOS(COALESCE(d."notes", ''), 'payrollItem=' || e."payroll_item_id") > 0
  LEFT JOIN "ledger_entries" le
    ON le."company_id" = e."company_id"
   AND le."reference_type" = 'advance_settlement'
   AND le."reference_id" = d."id"
  GROUP BY e."payroll_item_id"
)
SELECT
  e.*,
  p."posted_settlement",
  e."expected_settlement" - p."posted_settlement" AS "missing_settlement"
FROM expected e
JOIN posted p ON p."payroll_item_id" = e."payroll_item_id"
WHERE e."expected_settlement" - p."posted_settlement" > 0.01;

INSERT INTO "employee_deductions" (
  "id", "tenant_id", "company_id", "employee_id", "deduction_type", "amount",
  "transaction_date", "notes", "reference_id", "created_at"
)
SELECT
  md5('payroll-cost-gap-repair-v2:' || gap."payroll_item_id"),
  gap."tenant_id", gap."company_id", gap."employee_id", 'advance', gap."missing_settlement",
  gap."settlement_date",
  '[PAYROLL_COST_GAP_REPAIR_V2] run=' || gap."run_number" ||
    ', payrollItem=' || gap."payroll_item_id" ||
    ', nonCash=true',
  NULL, NOW()
FROM "_remaining_payroll_cost_gaps" gap
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ledger_entries" (
  "id", "tenant_id", "company_id", "debit_account_id", "credit_account_id", "amount",
  "transaction_date", "entry_date", "reference_type", "reference_id", "reporting_class",
  "vault_id", "employee_id", "created_by_id", "status", "created_at"
)
SELECT
  md5('advance-settlement:' || d."id"),
  d."tenant_id", d."company_id", salary_account."id", advance_account."id", d."amount",
  d."transaction_date", d."transaction_date", 'advance_settlement', d."id",
  'operating_payroll', NULL, d."employee_id", NULL, 'active', NOW()
FROM "_remaining_payroll_cost_gaps" gap
JOIN "employee_deductions" d
  ON d."id" = md5('payroll-cost-gap-repair-v2:' || gap."payroll_item_id")
JOIN "accounts" salary_account
  ON salary_account."company_id" = d."company_id"
 AND salary_account."code" = 'EXP-004'
 AND salary_account."type" = 'expense'
 AND salary_account."is_active" = true
JOIN "accounts" advance_account
  ON advance_account."company_id" = d."company_id"
 AND advance_account."code" = 'ADV-001'
 AND advance_account."type" = 'asset'
 AND advance_account."is_active" = true
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "audit_logs" (
  "id", "tenant_id", "company_id", "user_id", "action", "entity", "entity_id",
  "old_value", "new_value", "ip", "user_agent", "created_at"
)
SELECT
  md5('audit:payroll-cost-gap-repair-v2:' || d."id"),
  d."tenant_id", d."company_id", NULL, 'reconcile', 'payroll_cost_gap', d."id", NULL,
  jsonb_build_object(
    'employeeId', d."employee_id",
    'payrollRunId', gap."payroll_run_id",
    'runNumber', gap."run_number",
    'expectedAdvanceSettlement', gap."expected_settlement",
    'previouslyPosted', gap."posted_settlement",
    'reconciledAmount', gap."missing_settlement",
    'reason', 'remaining_historical_payroll_cost_gap'
  ),
  NULL, 'prisma-migration', NOW()
FROM "_remaining_payroll_cost_gaps" gap
JOIN "employee_deductions" d
  ON d."id" = md5('payroll-cost-gap-repair-v2:' || gap."payroll_item_id")
ON CONFLICT ("id") DO NOTHING;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM "_remaining_payroll_cost_gaps" gap
    LEFT JOIN "employee_deductions" d
      ON d."id" = md5('payroll-cost-gap-repair-v2:' || gap."payroll_item_id")
    LEFT JOIN "ledger_entries" le
      ON le."company_id" = gap."company_id"
     AND le."reference_type" = 'advance_settlement'
     AND le."reference_id" = d."id"
     AND le."status" = 'active'
    WHERE d."id" IS NULL
       OR le."id" IS NULL
       OR ABS(le."amount" - gap."missing_settlement") > 0.01
  ) THEN
    RAISE EXCEPTION 'REMAINING_PAYROLL_COST_GAP_REPAIR_INCOMPLETE';
  END IF;
END $$;

UPDATE "payroll_runs" pr
SET "advance_settlements_applied_at" = COALESCE(pr."advance_settlements_applied_at", NOW())
FROM "_remaining_payroll_cost_gaps" gap
WHERE gap."payroll_run_id" = pr."id";

COMMIT;

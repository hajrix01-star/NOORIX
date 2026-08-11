-- The first reconciliation required invoices.batch_id = payroll_runs.id and a
-- populated advances_deduct. Some paid legacy runs lack one of those modern
-- links even though their payroll equation still proves the advance deduction:
--   gross + allowances - ordinary deductions - net paid = advance settled.
-- This migration accepts a paid salary invoice by batch, number, or run note,
-- subtracts already-posted settlements, and posts only the remaining non-cash gap.

CREATE TEMP TABLE "_payroll_cost_gap_paid_runs" ON COMMIT DROP AS
SELECT
  pr."id" AS "payroll_run_id",
  pr."tenant_id",
  pr."company_id",
  pr."run_number",
  pr."payroll_month",
  salary_invoice."transaction_date" AS "settlement_date"
FROM "payroll_runs" pr
JOIN LATERAL (
  SELECT MIN(i."transaction_date") AS "transaction_date"
  FROM "invoices" i
  WHERE i."company_id" = pr."company_id"
    AND i."kind" = 'salary'
    AND i."status" = 'active'
    AND (
      i."batch_id" = pr."id"
      OR i."invoice_number" = 'SAL-' || pr."run_number"
      OR STRPOS(COALESCE(i."notes", ''), pr."run_number") > 0
    )
) salary_invoice ON salary_invoice."transaction_date" IS NOT NULL
WHERE pr."status" = 'completed';

CREATE TEMP TABLE "_payroll_cost_gap_reconcile" ON COMMIT DROP AS
WITH expected AS (
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
    ) AS "expected_amount"
  FROM "_payroll_cost_gap_paid_runs" paid
  JOIN "payroll_run_items" pri ON pri."payroll_run_id" = paid."payroll_run_id"
), posted AS (
  SELECT
    e."payroll_item_id",
    COALESCE(SUM(le."amount") FILTER (WHERE le."status" = 'active'), 0) AS "posted_amount"
  FROM expected e
  LEFT JOIN "employee_deductions" d
    ON d."company_id" = e."company_id"
   AND d."employee_id" = e."employee_id"
   AND d."deduction_type" = 'advance'
   AND STRPOS(COALESCE(d."notes", ''), e."run_number") > 0
  LEFT JOIN "ledger_entries" le
    ON le."company_id" = e."company_id"
   AND le."reference_type" = 'advance_settlement'
   AND le."reference_id" = d."id"
  GROUP BY e."payroll_item_id"
)
SELECT
  e.*,
  p."posted_amount",
  e."expected_amount" - p."posted_amount" AS "missing_amount"
FROM expected e
JOIN posted p ON p."payroll_item_id" = e."payroll_item_id"
WHERE e."expected_amount" - p."posted_amount" > 0.01;

INSERT INTO "employee_deductions" (
  "id", "tenant_id", "company_id", "employee_id", "deduction_type", "amount",
  "transaction_date", "notes", "reference_id", "created_at"
)
SELECT
  md5('payroll-advance-reconcile:' || c."payroll_item_id"),
  c."tenant_id", c."company_id", c."employee_id", 'advance', c."missing_amount",
  c."settlement_date",
  '[PAYROLL_ADVANCE_RECONCILIATION] run=' || c."run_number" ||
    ', payrollItem=' || c."payroll_item_id",
  NULL, NOW()
FROM "_payroll_cost_gap_reconcile" c
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
FROM "_payroll_cost_gap_reconcile" c
JOIN "employee_deductions" d
  ON d."id" = md5('payroll-advance-reconcile:' || c."payroll_item_id")
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
  md5('audit:payroll-cost-gap:' || d."id"),
  d."tenant_id", d."company_id", NULL, 'reconcile', 'payroll_cost_gap', d."id", NULL,
  jsonb_build_object(
    'employeeId', d."employee_id",
    'payrollRunId', c."payroll_run_id",
    'runNumber', c."run_number",
    'expectedAdvanceSettlement', c."expected_amount",
    'previouslyPosted', c."posted_amount",
    'reconciledAmount', c."missing_amount",
    'reason', 'historical_payroll_cost_gap'
  ),
  NULL, 'prisma-migration', NOW()
FROM "_payroll_cost_gap_reconcile" c
JOIN "employee_deductions" d
  ON d."id" = md5('payroll-advance-reconcile:' || c."payroll_item_id")
ON CONFLICT ("id") DO NOTHING;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1
    FROM "_payroll_cost_gap_reconcile" c
    LEFT JOIN "employee_deductions" d
      ON d."id" = md5('payroll-advance-reconcile:' || c."payroll_item_id")
    LEFT JOIN "ledger_entries" le
      ON le."reference_type" = 'advance_settlement'
     AND le."reference_id" = d."id"
     AND le."company_id" = c."company_id"
     AND le."status" = 'active'
    WHERE d."id" IS NULL OR le."id" IS NULL OR ABS(le."amount" - c."missing_amount") > 0.01
  ) THEN
    RAISE EXCEPTION 'PAYROLL_COST_GAP_RECONCILIATION_INCOMPLETE';
  END IF;
END $$;

-- A replay of an already-paid historical run must not settle its advances again.
UPDATE "payroll_runs" pr
SET "advance_settlements_applied_at" = COALESCE(pr."advance_settlements_applied_at", NOW())
FROM "_payroll_cost_gap_paid_runs" paid
WHERE paid."payroll_run_id" = pr."id";

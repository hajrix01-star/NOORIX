-- Historical payroll invoices store the net cash paid after employee advances.
-- Every deducted advance must therefore also have a non-cash ledger settlement:
--   Dr EXP-004 Salaries / Cr ADV-001 Employee advances.
-- This migration is additive, deterministic and idempotent. It never changes an
-- invoice, payroll run, vault movement, or an advance balance.

CREATE TEMP TABLE "_payroll_advance_reconcile_candidates" ON COMMIT DROP AS
SELECT
  pri."id" AS "payroll_item_id",
  pr."id" AS "payroll_run_id",
  pr."tenant_id",
  pr."company_id",
  pr."run_number",
  pri."employee_id",
  pri."advances_deduct" AS "expected_amount",
  salary_invoice."transaction_date" AS "settlement_date"
FROM "payroll_run_items" pri
JOIN "payroll_runs" pr
  ON pr."id" = pri."payroll_run_id"
JOIN LATERAL (
  SELECT MIN(i."transaction_date") AS "transaction_date"
  FROM "invoices" i
  WHERE i."company_id" = pr."company_id"
    AND i."batch_id" = pr."id"
    AND i."kind" = 'salary'
    AND i."status" = 'active'
) salary_invoice ON salary_invoice."transaction_date" IS NOT NULL
WHERE pr."status" = 'completed'
  AND pri."advances_deduct" > 0;

-- Restore ledger rows for historical EmployeeDeduction records that were
-- created by payroll but missed by the earlier restrictive backfill.
INSERT INTO "ledger_entries" (
  "id", "tenant_id", "company_id", "debit_account_id", "credit_account_id", "amount",
  "transaction_date", "entry_date", "reference_type", "reference_id", "reporting_class",
  "vault_id", "employee_id", "created_by_id", "status", "created_at"
)
SELECT DISTINCT ON (d."id")
  md5('advance-settlement:' || d."id"),
  d."tenant_id",
  d."company_id",
  salary_account."id",
  advance_account."id",
  d."amount",
  d."transaction_date",
  d."transaction_date",
  'advance_settlement',
  d."id",
  'operating_payroll',
  NULL,
  d."employee_id",
  NULL,
  'active',
  NOW()
FROM "employee_deductions" d
JOIN "_payroll_advance_reconcile_candidates" c
  ON c."company_id" = d."company_id"
 AND c."employee_id" = d."employee_id"
LEFT JOIN "invoices" advance_invoice
  ON advance_invoice."id" = d."reference_id"
 AND advance_invoice."company_id" = d."company_id"
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
WHERE d."deduction_type" = 'advance'
  AND d."amount" > 0
  AND (
    STRPOS(COALESCE(d."notes", ''), c."run_number") > 0
    OR STRPOS(COALESCE(advance_invoice."notes", ''), '[ADV_PAYROLL] run=' || c."run_number" || ',') > 0
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "ledger_entries" existing
    WHERE existing."reference_type" = 'advance_settlement'
      AND existing."reference_id" = d."id"
  )
ORDER BY d."id", c."payroll_item_id"
ON CONFLICT ("id") DO NOTHING;

-- If a legacy payroll item has the deducted amount but its old deduction rows are
-- incomplete, create one traceable reconciliation record for the remaining amount.
WITH posted AS (
  SELECT
    c."payroll_item_id",
    COALESCE(SUM(le."amount") FILTER (WHERE le."status" = 'active'), 0) AS "posted_amount"
  FROM "_payroll_advance_reconcile_candidates" c
  LEFT JOIN "employee_deductions" d
    ON d."company_id" = c."company_id"
   AND d."employee_id" = c."employee_id"
   AND d."deduction_type" = 'advance'
   AND STRPOS(COALESCE(d."notes", ''), c."run_number") > 0
  LEFT JOIN "ledger_entries" le
    ON le."company_id" = c."company_id"
   AND le."reference_type" = 'advance_settlement'
   AND le."reference_id" = d."id"
  GROUP BY c."payroll_item_id"
), missing AS (
  SELECT c.*, c."expected_amount" - p."posted_amount" AS "missing_amount"
  FROM "_payroll_advance_reconcile_candidates" c
  JOIN posted p ON p."payroll_item_id" = c."payroll_item_id"
  WHERE c."expected_amount" - p."posted_amount" > 0.01
)
INSERT INTO "employee_deductions" (
  "id", "tenant_id", "company_id", "employee_id", "deduction_type", "amount",
  "transaction_date", "notes", "reference_id", "created_at"
)
SELECT
  md5('payroll-advance-reconcile:' || m."payroll_item_id"),
  m."tenant_id",
  m."company_id",
  m."employee_id",
  'advance',
  m."missing_amount",
  m."settlement_date",
  '[PAYROLL_ADVANCE_RECONCILIATION] run=' || m."run_number" || ', payrollItem=' || m."payroll_item_id",
  NULL,
  NOW()
FROM missing m
ON CONFLICT ("id") DO NOTHING;

-- Post the synthetic reconciliation rows. There is intentionally no vault_id:
-- the cash left when the advance was originally paid, not again with payroll.
INSERT INTO "ledger_entries" (
  "id", "tenant_id", "company_id", "debit_account_id", "credit_account_id", "amount",
  "transaction_date", "entry_date", "reference_type", "reference_id", "reporting_class",
  "vault_id", "employee_id", "created_by_id", "status", "created_at"
)
SELECT
  md5('advance-settlement:' || d."id"),
  d."tenant_id",
  d."company_id",
  salary_account."id",
  advance_account."id",
  d."amount",
  d."transaction_date",
  d."transaction_date",
  'advance_settlement',
  d."id",
  'operating_payroll',
  NULL,
  d."employee_id",
  NULL,
  'active',
  NOW()
FROM "_payroll_advance_reconcile_candidates" c
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
WHERE NOT EXISTS (
  SELECT 1
  FROM "ledger_entries" existing
  WHERE existing."reference_type" = 'advance_settlement'
    AND existing."reference_id" = d."id"
)
ON CONFLICT ("id") DO NOTHING;

-- Preserve an explicit audit trail for synthetic historical corrections.
INSERT INTO "audit_logs" (
  "id", "tenant_id", "company_id", "user_id", "action", "entity", "entity_id",
  "old_value", "new_value", "ip", "user_agent", "created_at"
)
SELECT
  md5('audit:payroll-advance-reconcile:' || d."id"),
  d."tenant_id",
  d."company_id",
  NULL,
  'reconcile',
  'payroll_advance_settlement',
  d."id",
  NULL,
  jsonb_build_object(
    'amount', d."amount",
    'employeeId', d."employee_id",
    'transactionDate', d."transaction_date",
    'reason', 'historical_missing_payroll_advance_settlement'
  ),
  NULL,
  'prisma-migration',
  NOW()
FROM "_payroll_advance_reconcile_candidates" c
JOIN "employee_deductions" d
  ON d."id" = md5('payroll-advance-reconcile:' || c."payroll_item_id")
ON CONFLICT ("id") DO NOTHING;

-- Fail closed: a paid completed payroll must reconcile exactly to the advance
-- deduction recorded on its payroll items. This prevents silent partial repair.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "_payroll_advance_reconcile_candidates" c
    LEFT JOIN LATERAL (
      SELECT COALESCE(SUM(le."amount"), 0) AS "posted_amount"
      FROM "employee_deductions" d
      JOIN "ledger_entries" le
        ON le."company_id" = c."company_id"
       AND le."reference_type" = 'advance_settlement'
       AND le."reference_id" = d."id"
       AND le."status" = 'active'
      WHERE d."company_id" = c."company_id"
        AND d."employee_id" = c."employee_id"
        AND d."deduction_type" = 'advance'
        AND STRPOS(COALESCE(d."notes", ''), c."run_number") > 0
    ) totals ON true
    WHERE ABS(c."expected_amount" - totals."posted_amount") > 0.01
  ) THEN
    RAISE EXCEPTION 'PAYROLL_ADVANCE_SETTLEMENT_BACKFILL_INCOMPLETE';
  END IF;
END $$;
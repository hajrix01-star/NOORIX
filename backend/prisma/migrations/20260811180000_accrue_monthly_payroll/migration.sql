-- Monthly payroll is accrued when the run is approved. Cash payments settle PAY-001.
ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "payroll_accrued_at" TIMESTAMP(3);

-- Existing completed runs already posted salary expense through the legacy payment path.
-- Mark them as handled without duplicating their historical expense.
UPDATE "payroll_runs"
SET "payroll_accrued_at" = COALESCE("advance_settlements_applied_at", "updated_at", CURRENT_TIMESTAMP)
WHERE "status" = 'completed'
  AND "payroll_accrued_at" IS NULL
  AND EXISTS (
    SELECT 1
    FROM "invoices" i
    WHERE i."company_id" = "payroll_runs"."company_id"
      AND i."batch_id" = "payroll_runs"."id"
      AND i."kind" = 'salary'
      AND i."status" = 'active'
  );

INSERT INTO "accounts" (
  "id", "tenant_id", "company_id", "code", "name_ar", "name_en", "type",
  "icon", "is_active", "tax_exempt", "created_at", "updated_at"
)
SELECT
  concat('payroll-payable-', c."id"), c."tenant_id", c."id", 'PAY-001',
  U&'\0631\0648\0627\062A\0628 \0645\0633\062A\062D\0642\0629',
  'Payroll Payable', 'liability', U&'\+01F4BC', true, true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (
  SELECT 1 FROM "accounts" a
  WHERE a."company_id" = c."id" AND a."code" = 'PAY-001'
);

ALTER TABLE "ledger_entries"
  DROP CONSTRAINT IF EXISTS "ledger_entries_reporting_class_check";
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_reporting_class_check"
  CHECK ("reporting_class" IN (
    'operating_revenue', 'operating_purchase', 'operating_recurring_expense',
    'operating_other_expense', 'operating_payroll', 'non_operating_advance',
    'non_operating_payroll_payment', 'non_operating_loan', 'internal_transfer',
    'tax_collected', 'unclassified'
  ));

CREATE INDEX IF NOT EXISTS "ledger_entries_payroll_reference_idx"
  ON "ledger_entries" ("company_id", "reference_type", "reference_id", "status");

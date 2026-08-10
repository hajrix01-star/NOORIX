-- Category reporting defaults are used only for future operational postings.
-- Posted LedgerEntry.reporting_class remains the historical reporting snapshot.
ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "reporting_class" TEXT NOT NULL DEFAULT 'operating_other_expense';

-- Roots receive the deterministic master-code map, then a safe type default.
UPDATE "categories"
SET "reporting_class" = CASE
  WHEN UPPER(COALESCE("code", '')) LIKE 'PUR-%' THEN 'operating_purchase'
  WHEN UPPER(COALESCE("code", '')) = 'REV-001' THEN 'operating_revenue'
  WHEN UPPER(COALESCE("code", '')) = 'EXP-004' THEN 'operating_payroll'
  WHEN UPPER(COALESCE("code", '')) IN (
    'EXP-003',
    'E3-1', 'E3-2', 'E3-3', 'E3-4', 'E3-5',
    'E2-1', 'E2-2', 'E2-3', 'E2-4', 'E2-7', 'E2-8', 'E2-10', 'E2-11',
    'E4-2'
  ) THEN 'operating_recurring_expense'
  WHEN "type" = 'purchase' THEN 'operating_purchase'
  WHEN "type" = 'sale' THEN 'operating_revenue'
  ELSE 'operating_other_expense'
END
WHERE "parent_id" IS NULL;

-- Existing children inherit their parent unless their own master code is explicit.
UPDATE "categories" AS child
SET "reporting_class" = CASE
  WHEN UPPER(COALESCE(child."code", '')) LIKE 'PUR-%' THEN 'operating_purchase'
  WHEN UPPER(COALESCE(child."code", '')) = 'REV-001' THEN 'operating_revenue'
  WHEN UPPER(COALESCE(child."code", '')) = 'EXP-004' THEN 'operating_payroll'
  WHEN UPPER(COALESCE(child."code", '')) IN (
    'EXP-003',
    'E3-1', 'E3-2', 'E3-3', 'E3-4', 'E3-5',
    'E2-1', 'E2-2', 'E2-3', 'E2-4', 'E2-7', 'E2-8', 'E2-10', 'E2-11',
    'E4-2'
  ) THEN 'operating_recurring_expense'
  ELSE parent."reporting_class"
END
FROM "categories" AS parent
WHERE child."parent_id" = parent."id";

ALTER TABLE "categories"
  DROP CONSTRAINT IF EXISTS "categories_reporting_class_check";
ALTER TABLE "categories"
  ADD CONSTRAINT "categories_reporting_class_check"
  CHECK ("reporting_class" IN (
    'operating_revenue',
    'operating_purchase',
    'operating_recurring_expense',
    'operating_other_expense',
    'operating_payroll'
  ));

CREATE INDEX IF NOT EXISTS "categories_company_id_reporting_class_idx"
  ON "categories"("company_id", "reporting_class");
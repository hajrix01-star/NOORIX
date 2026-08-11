BEGIN;

ALTER TABLE "ledger_entries"
  ADD COLUMN "reporting_category_id" TEXT,
  ADD COLUMN "reporting_category_name_ar" TEXT,
  ADD COLUMN "reporting_category_name_en" TEXT;

-- Preserve the business category used by historical operational invoices.
-- Amounts and reporting classes remain untouched.
UPDATE "ledger_entries" AS le
SET
  "reporting_category_id" = c."id",
  "reporting_category_name_ar" = c."name_ar",
  "reporting_category_name_en" = c."name_en"
FROM "invoices" AS i
JOIN "categories" AS c
  ON c."id" = i."category_id"
 AND c."company_id" = i."company_id"
WHERE le."company_id" = i."company_id"
  AND le."reference_id" = i."id"
  AND le."reference_type" IN ('invoice', 'salary')
  AND le."reporting_class" IN (
    'operating_purchase',
    'operating_recurring_expense',
    'operating_other_expense',
    'operating_payroll'
  );

CREATE INDEX "ledger_entries_company_status_txdate_reporting_category_idx"
  ON "ledger_entries"("company_id", "status", "transaction_date", "reporting_category_id");

COMMIT;

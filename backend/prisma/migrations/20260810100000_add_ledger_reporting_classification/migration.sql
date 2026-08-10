ALTER TABLE "ledger_entries"
  ADD COLUMN IF NOT EXISTS "reporting_class" TEXT NOT NULL DEFAULT 'unclassified';

UPDATE "ledger_entries"
SET "reporting_class" = CASE "reference_type"
  WHEN 'sale' THEN 'operating_revenue'
  WHEN 'salary' THEN 'operating_payroll'
  WHEN 'advance_settlement' THEN 'operating_payroll'
  WHEN 'advance' THEN 'non_operating_advance'
  WHEN 'loan_opening' THEN 'non_operating_loan'
  WHEN 'loan_payment' THEN 'non_operating_loan'
  WHEN 'loan_payment_reversal' THEN 'non_operating_loan'
  WHEN 'transfer' THEN 'internal_transfer'
  ELSE "reporting_class"
END
WHERE "reporting_class" = 'unclassified';

-- VAT entries from sales are a tax disclosure, never operating revenue.
UPDATE "ledger_entries" le
SET "reporting_class" = 'tax_collected'
FROM "accounts" ca
WHERE le."credit_account_id" = ca."id"
  AND le."reference_type" = 'sale'
  AND ca."code" LIKE 'TAX%'
  AND le."reporting_class" = 'operating_revenue';

UPDATE "ledger_entries" le
SET "reporting_class" = 'operating_recurring_expense'
FROM "employee_residencies" er
WHERE le."reference_id" = er."invoice_id"
  AND le."company_id" = er."company_id"
  AND le."reference_type" = 'invoice'
  AND er."service_category" IN ('iqama_renewal', 'medical_insurance', 'health_certificate')
  AND le."reporting_class" = 'unclassified';

UPDATE "ledger_entries" le
SET "reporting_class" = CASE i."kind"
  WHEN 'purchase' THEN 'operating_purchase'
  WHEN 'fixed_expense' THEN 'operating_recurring_expense'
  WHEN 'salary' THEN 'operating_payroll'
  WHEN 'advance' THEN 'non_operating_advance'
  WHEN 'expense' THEN 'operating_other_expense'
  WHEN 'hr_expense' THEN 'operating_other_expense'
  ELSE 'unclassified'
END
FROM "invoices" i
WHERE le."reference_id" = i."id"
  AND le."company_id" = i."company_id"
  AND le."reference_type" IN ('invoice', 'salary', 'advance')
  AND le."reporting_class" = 'unclassified';

UPDATE "ledger_entries" le
SET "reporting_class" = CASE
  WHEN da."code" LIKE 'PUR%' THEN 'operating_purchase'
  WHEN da."code" = 'EXP-004' THEN 'operating_payroll'
  ELSE 'unclassified'
END
FROM "accounts" da
WHERE le."debit_account_id" = da."id"
  AND le."reporting_class" = 'unclassified'
  AND (da."code" LIKE 'PUR%' OR da."code" = 'EXP-004');

ALTER TABLE "ledger_entries"
  DROP CONSTRAINT IF EXISTS "ledger_entries_reporting_class_check";
ALTER TABLE "ledger_entries"
  ADD CONSTRAINT "ledger_entries_reporting_class_check"
  CHECK ("reporting_class" IN (
    'operating_revenue', 'operating_purchase', 'operating_recurring_expense',
    'operating_other_expense', 'operating_payroll', 'non_operating_advance',
    'non_operating_loan', 'internal_transfer', 'tax_collected', 'unclassified'
  ));
CREATE INDEX IF NOT EXISTS "ledger_entries_company_status_txdate_reporting_class_idx"
  ON "ledger_entries" ("company_id", "status", "transaction_date", "reporting_class");

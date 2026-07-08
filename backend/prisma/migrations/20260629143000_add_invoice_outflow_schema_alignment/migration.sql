ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "expense_line_id" TEXT;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "category_id" TEXT;

ALTER TABLE "invoices"
ALTER COLUMN "supplier_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "invoices_company_id_expense_line_id_idx"
ON "invoices"("company_id", "expense_line_id");

CREATE INDEX IF NOT EXISTS "invoices_company_id_category_id_idx"
ON "invoices"("company_id", "category_id");

DO $$
BEGIN
  IF to_regclass('public.expense_lines') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM pg_constraint
       WHERE conname = 'invoices_expense_line_id_fkey'
     ) THEN
    ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_expense_line_id_fkey"
    FOREIGN KEY ("expense_line_id") REFERENCES "expense_lines"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

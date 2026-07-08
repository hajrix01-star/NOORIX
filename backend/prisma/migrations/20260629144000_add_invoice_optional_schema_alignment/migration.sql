ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "invoice_date" TIMESTAMP(3);

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "supplier_invoice_number" TEXT;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "supplier_invoice_dedup_key" TEXT;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "attachment_path" TEXT;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "attachment_original_name" TEXT;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "settled_at" TIMESTAMP(3);

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "settled_amount" DECIMAL(18, 4);

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "installment_count" INTEGER;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "installment_amount" DECIMAL(18, 4);

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "expense_coverage_year" INTEGER;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "expense_coverage_quarter" INTEGER;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "expense_coverage_month_start" INTEGER;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "expense_months_covered" INTEGER;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "warranty_follow_up" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "warranty_follow_up_done" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "invoices_company_kind_warranty_queue_idx"
ON "invoices"("company_id", "kind", "warranty_follow_up", "warranty_follow_up_done");

CREATE INDEX IF NOT EXISTS "invoices_company_id_created_by_user_id_idx"
ON "invoices"("company_id", "created_by_user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'invoices_created_by_user_id_fkey'
  ) THEN
    ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

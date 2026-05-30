-- Expand employee_residencies → unified HR employee services (إقامات + تأشيرات + تذاكر + تأمين)

ALTER TABLE "employee_residencies" ADD COLUMN IF NOT EXISTS "service_category" TEXT NOT NULL DEFAULT 'iqama_renewal';
ALTER TABLE "employee_residencies" ADD COLUMN IF NOT EXISTS "reference_label" TEXT;
ALTER TABLE "employee_residencies" ADD COLUMN IF NOT EXISTS "transaction_date" TIMESTAMP(3);
ALTER TABLE "employee_residencies" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE "employee_residencies" ALTER COLUMN "iqama_number" DROP NOT NULL;
ALTER TABLE "employee_residencies" ALTER COLUMN "expiry_date" DROP NOT NULL;

UPDATE "employee_residencies" SET "service_category" = 'iqama_renewal' WHERE "service_category" IS NULL OR "service_category" = '';

CREATE INDEX IF NOT EXISTS "employee_residencies_company_id_service_category_idx"
  ON "employee_residencies"("company_id", "service_category");

-- Unique invoice link (one service record per invoice)
CREATE UNIQUE INDEX IF NOT EXISTS "employee_residencies_invoice_id_key"
  ON "employee_residencies"("invoice_id") WHERE "invoice_id" IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_residencies_invoice_id_fkey'
  ) THEN
    ALTER TABLE "employee_residencies"
      ADD CONSTRAINT "employee_residencies_invoice_id_fkey"
      FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

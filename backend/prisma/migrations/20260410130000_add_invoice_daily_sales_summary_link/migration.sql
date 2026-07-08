-- Link sale invoices to their daily sales summary before allocation backfill.

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "daily_sales_summary_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "invoices_daily_sales_summary_id_key"
  ON "invoices"("daily_sales_summary_id");

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_daily_sales_summary_id_fkey"
  FOREIGN KEY ("daily_sales_summary_id") REFERENCES "daily_sales_summaries"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

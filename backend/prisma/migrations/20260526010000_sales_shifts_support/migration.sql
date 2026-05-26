-- Company-level toggle: enable/disable sales shifts in UI
ALTER TABLE "companies"
ADD COLUMN IF NOT EXISTS "sales_shifts_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Shift discriminator for daily sales summaries
ALTER TABLE "daily_sales_summaries"
ADD COLUMN IF NOT EXISTS "shift" TEXT NOT NULL DEFAULT 'all';

-- Reporting helper index for date + shift filtering
CREATE INDEX IF NOT EXISTS "daily_sales_summaries_company_id_shift_transaction_date_idx"
ON "daily_sales_summaries" ("company_id", "shift", "transaction_date");

-- AlterTable
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "vat_enabled_for_sales" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "vat_rate_percent" DECIMAL(5,2) NOT NULL DEFAULT 15;

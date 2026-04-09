-- Add installment fields to invoices table (for advance/loan installment tracking)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "installment_count" INTEGER;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "installment_amount" DECIMAL(18,4);

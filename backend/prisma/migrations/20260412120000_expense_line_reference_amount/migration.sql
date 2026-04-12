-- AlterTable
ALTER TABLE "expense_lines" ADD COLUMN IF NOT EXISTS "reference_amount" DECIMAL(18,2);
ALTER TABLE "expense_lines" ADD COLUMN IF NOT EXISTS "allow_payment_amount_override" BOOLEAN NOT NULL DEFAULT true;

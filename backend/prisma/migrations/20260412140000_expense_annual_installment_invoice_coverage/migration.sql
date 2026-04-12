-- AlterTable expense_lines: annual total + installment interval for suggested per-payment amount
ALTER TABLE "expense_lines" ADD COLUMN IF NOT EXISTS "annual_total_amount" DECIMAL(18,2);
ALTER TABLE "expense_lines" ADD COLUMN IF NOT EXISTS "installment_interval_months" INTEGER;

-- AlterTable invoices: coverage period for fixed-expense payments
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "expense_coverage_year" INTEGER;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "expense_coverage_quarter" INTEGER;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "expense_coverage_month_start" INTEGER;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "expense_months_covered" INTEGER;

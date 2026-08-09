-- Keep the monthly payroll as the default and explicitly identify any extra payroll.
ALTER TABLE "payroll_runs"
  ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'regular';

ALTER TABLE "payroll_runs"
  DROP CONSTRAINT IF EXISTS "payroll_runs_kind_check";

ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "payroll_runs_kind_check"
  CHECK ("kind" IN ('regular', 'supplementary'));

CREATE INDEX IF NOT EXISTS "payroll_runs_company_id_payroll_month_kind_idx"
  ON "payroll_runs"("company_id", "payroll_month", "kind");

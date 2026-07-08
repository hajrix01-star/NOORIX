-- Payroll run foundation tables.
-- This migration is intentionally placed before advance-settlement and vault-split
-- payroll migrations because those later migrations alter/reference payroll_runs.

CREATE TABLE IF NOT EXISTS "payroll_runs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "run_number" TEXT NOT NULL,
  "payroll_month" TIMESTAMP(3) NOT NULL,
  "total_amount" DECIMAL(18, 4) NOT NULL,
  "employee_count" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payroll_run_items" (
  "id" TEXT NOT NULL,
  "payroll_run_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "gross_salary" DECIMAL(18, 4) NOT NULL,
  "allowances_add" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "deductions" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "advances_deduct" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "net_salary" DECIMAL(18, 4) NOT NULL,
  "notes" TEXT,
  CONSTRAINT "payroll_run_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "payroll_run_item_vaults" (
  "id" TEXT NOT NULL,
  "payroll_item_id" TEXT NOT NULL,
  "vault_id" TEXT NOT NULL,
  "amount" DECIMAL(18, 4) NOT NULL,
  CONSTRAINT "payroll_run_item_vaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_runs_company_id_run_number_key"
  ON "payroll_runs"("company_id", "run_number");
CREATE INDEX IF NOT EXISTS "payroll_runs_tenant_id_idx" ON "payroll_runs"("tenant_id");
CREATE INDEX IF NOT EXISTS "payroll_runs_company_id_idx" ON "payroll_runs"("company_id");
CREATE INDEX IF NOT EXISTS "payroll_runs_company_id_payroll_month_idx"
  ON "payroll_runs"("company_id", "payroll_month");

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_run_items_payroll_run_id_employee_id_key"
  ON "payroll_run_items"("payroll_run_id", "employee_id");
CREATE INDEX IF NOT EXISTS "payroll_run_items_employee_id_idx"
  ON "payroll_run_items"("employee_id");

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_run_item_vaults_payroll_item_id_vault_id_key"
  ON "payroll_run_item_vaults"("payroll_item_id", "vault_id");
CREATE INDEX IF NOT EXISTS "payroll_run_item_vaults_payroll_item_id_idx"
  ON "payroll_run_item_vaults"("payroll_item_id");

ALTER TABLE "payroll_runs"
  ADD CONSTRAINT "payroll_runs_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_run_items"
  ADD CONSTRAINT "payroll_run_items_payroll_run_id_fkey"
  FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_run_items"
  ADD CONSTRAINT "payroll_run_items_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_run_item_vaults"
  ADD CONSTRAINT "payroll_run_item_vaults_payroll_item_id_fkey"
  FOREIGN KEY ("payroll_item_id") REFERENCES "payroll_run_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payroll_run_item_vaults"
  ADD CONSTRAINT "payroll_run_item_vaults_vault_id_fkey"
  FOREIGN KEY ("vault_id") REFERENCES "vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "payroll_advance_settlements" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "payroll_run_id" TEXT,
  "payroll_run_item_id" TEXT,
  "advance_invoice_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "deduction_id" TEXT,
  "ledger_entry_id" TEXT,
  "amount" DECIMAL(18,4) NOT NULL,
  "settlement_date" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "origin" TEXT NOT NULL DEFAULT 'payroll',
  "idempotency_key" TEXT NOT NULL,
  "reversal_of_id" TEXT,
  "reversed_at" TIMESTAMP(3),
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payroll_advance_settlements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payroll_advance_settlements_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "payroll_advance_settlements_status_check" CHECK ("status" IN ('active', 'reversed')),
  CONSTRAINT "payroll_advance_settlements_reversal_check" CHECK (
    ("status" = 'active' AND "reversed_at" IS NULL) OR
    ("status" = 'reversed' AND "reversed_at" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "payroll_advance_settlements_deduction_id_key" ON "payroll_advance_settlements"("deduction_id");
CREATE UNIQUE INDEX "payroll_advance_settlements_reversal_of_id_key" ON "payroll_advance_settlements"("reversal_of_id");
CREATE UNIQUE INDEX "payroll_advance_settlements_company_id_idempotency_key_key" ON "payroll_advance_settlements"("company_id", "idempotency_key");
CREATE UNIQUE INDEX "payroll_advance_settlements_active_source_key" ON "payroll_advance_settlements"("company_id", "payroll_run_item_id", "advance_invoice_id") WHERE "reversal_of_id" IS NULL;
CREATE INDEX "payroll_advance_settlements_tenant_id_idx" ON "payroll_advance_settlements"("tenant_id");
CREATE INDEX "payroll_advance_settlements_company_id_settlement_date_idx" ON "payroll_advance_settlements"("company_id", "settlement_date");
CREATE INDEX "payroll_advance_settlements_payroll_run_id_idx" ON "payroll_advance_settlements"("payroll_run_id");
CREATE INDEX "payroll_advance_settlements_payroll_run_item_id_idx" ON "payroll_advance_settlements"("payroll_run_item_id");
CREATE INDEX "payroll_advance_settlements_advance_invoice_id_status_idx" ON "payroll_advance_settlements"("advance_invoice_id", "status");
CREATE INDEX "payroll_advance_settlements_employee_id_settlement_date_idx" ON "payroll_advance_settlements"("employee_id", "settlement_date");
CREATE INDEX "payroll_advance_settlements_ledger_entry_id_idx" ON "payroll_advance_settlements"("ledger_entry_id");

ALTER TABLE "payroll_advance_settlements" ADD CONSTRAINT "payroll_advance_settlements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_advance_settlements" ADD CONSTRAINT "payroll_advance_settlements_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_advance_settlements" ADD CONSTRAINT "payroll_advance_settlements_payroll_run_item_id_fkey" FOREIGN KEY ("payroll_run_item_id") REFERENCES "payroll_run_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_advance_settlements" ADD CONSTRAINT "payroll_advance_settlements_advance_invoice_id_fkey" FOREIGN KEY ("advance_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_advance_settlements" ADD CONSTRAINT "payroll_advance_settlements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_advance_settlements" ADD CONSTRAINT "payroll_advance_settlements_deduction_id_fkey" FOREIGN KEY ("deduction_id") REFERENCES "employee_deductions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_advance_settlements" ADD CONSTRAINT "payroll_advance_settlements_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_advance_settlements" ADD CONSTRAINT "payroll_advance_settlements_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "payroll_advance_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payroll_advance_settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payroll_advance_settlements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "payroll_advance_settlements_tenant_select" ON "payroll_advance_settlements" FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "payroll_advance_settlements_tenant_insert" ON "payroll_advance_settlements" FOR INSERT WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "payroll_advance_settlements_tenant_update" ON "payroll_advance_settlements" FOR UPDATE USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "payroll_advance_settlements_tenant_delete" ON "payroll_advance_settlements" FOR DELETE USING ("tenant_id" = current_tenant_id());

-- Explains existing historical payroll cost only. No ledger, invoice, vault, or advance data is changed.
CREATE TABLE "historical_part_time_payroll_links" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "ledger_entry_id" TEXT NOT NULL,
  "employee_id" TEXT,
  "payroll_month" DATE NOT NULL,
  "employee_match_source" TEXT NOT NULL DEFAULT 'none',
  "description_snapshot" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_by_id" TEXT,
  "reversed_at" TIMESTAMP(3),
  "reversed_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "historical_part_time_payroll_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "historical_part_time_payroll_links_status_check" CHECK ("status" IN ('active', 'reversed')),
  CONSTRAINT "historical_part_time_payroll_links_employee_match_check" CHECK ("employee_match_source" IN ('ledger', 'description', 'none'))
);

CREATE UNIQUE INDEX "historical_part_time_payroll_links_ledger_entry_id_key" ON "historical_part_time_payroll_links"("ledger_entry_id");
CREATE INDEX "historical_part_time_payroll_links_tenant_id_idx" ON "historical_part_time_payroll_links"("tenant_id");
CREATE INDEX "historical_part_time_payroll_links_company_month_status_idx" ON "historical_part_time_payroll_links"("company_id", "payroll_month", "status");
CREATE INDEX "historical_part_time_payroll_links_employee_id_idx" ON "historical_part_time_payroll_links"("employee_id");

ALTER TABLE "historical_part_time_payroll_links" ADD CONSTRAINT "historical_part_time_payroll_links_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "historical_part_time_payroll_links" ADD CONSTRAINT "historical_part_time_payroll_links_ledger_entry_id_fkey" FOREIGN KEY ("ledger_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historical_part_time_payroll_links" ADD CONSTRAINT "historical_part_time_payroll_links_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "historical_part_time_payroll_links" ADD CONSTRAINT "historical_part_time_payroll_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "historical_part_time_payroll_links" ADD CONSTRAINT "historical_part_time_payroll_links_reversed_by_id_fkey" FOREIGN KEY ("reversed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "historical_part_time_payroll_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "historical_part_time_payroll_links" FORCE ROW LEVEL SECURITY;
CREATE POLICY "historical_part_time_payroll_links_tenant_select" ON "historical_part_time_payroll_links" FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "historical_part_time_payroll_links_tenant_insert" ON "historical_part_time_payroll_links" FOR INSERT WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "historical_part_time_payroll_links_tenant_update" ON "historical_part_time_payroll_links" FOR UPDATE USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "historical_part_time_payroll_links_tenant_delete" ON "historical_part_time_payroll_links" FOR DELETE USING ("tenant_id" = current_tenant_id());

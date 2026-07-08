-- HR ancillary foundation tables.
-- Placed before leave salary settlement and later HR service expansion migrations.

CREATE TABLE IF NOT EXISTS "leaves" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "leave_type" TEXT NOT NULL,
  "start_date" TIMESTAMP(3) NOT NULL,
  "end_date" TIMESTAMP(3) NOT NULL,
  "days_count" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "leaves_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_residencies" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "service_category" TEXT NOT NULL DEFAULT 'iqama_renewal',
  "iqama_number" TEXT,
  "reference_label" TEXT,
  "issue_date" TIMESTAMP(3),
  "expiry_date" TIMESTAMP(3),
  "transaction_date" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'active',
  "notes" TEXT,
  "metadata" JSONB,
  "invoice_id" TEXT,
  "residency_invoice_amount" DECIMAL(18, 4),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_residencies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_documents" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "document_type" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_path" TEXT,
  "file_size" INTEGER,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_movements" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "movement_type" TEXT NOT NULL,
  "amount" DECIMAL(18, 4),
  "previous_value" TEXT,
  "new_value" TEXT,
  "effective_date" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_custom_allowances" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "amount" DECIMAL(18, 4) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_custom_allowances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "employee_deductions" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "deduction_type" TEXT NOT NULL,
  "amount" DECIMAL(18, 4) NOT NULL,
  "transaction_date" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "reference_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_deductions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "leaves_tenant_id_idx" ON "leaves"("tenant_id");
CREATE INDEX IF NOT EXISTS "leaves_company_id_idx" ON "leaves"("company_id");
CREATE INDEX IF NOT EXISTS "leaves_company_id_employee_id_idx" ON "leaves"("company_id", "employee_id");
CREATE INDEX IF NOT EXISTS "leaves_company_id_start_date_idx" ON "leaves"("company_id", "start_date");

CREATE INDEX IF NOT EXISTS "employee_residencies_tenant_id_idx" ON "employee_residencies"("tenant_id");
CREATE INDEX IF NOT EXISTS "employee_residencies_company_id_idx" ON "employee_residencies"("company_id");
CREATE INDEX IF NOT EXISTS "employee_residencies_company_id_employee_id_idx" ON "employee_residencies"("company_id", "employee_id");
CREATE INDEX IF NOT EXISTS "employee_residencies_company_id_expiry_date_idx" ON "employee_residencies"("company_id", "expiry_date");
CREATE INDEX IF NOT EXISTS "employee_residencies_company_id_service_category_idx" ON "employee_residencies"("company_id", "service_category");
CREATE UNIQUE INDEX IF NOT EXISTS "employee_residencies_invoice_id_key" ON "employee_residencies"("invoice_id") WHERE "invoice_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "employee_documents_tenant_id_idx" ON "employee_documents"("tenant_id");
CREATE INDEX IF NOT EXISTS "employee_documents_company_id_idx" ON "employee_documents"("company_id");
CREATE INDEX IF NOT EXISTS "employee_documents_company_id_employee_id_idx" ON "employee_documents"("company_id", "employee_id");

CREATE INDEX IF NOT EXISTS "employee_movements_tenant_id_idx" ON "employee_movements"("tenant_id");
CREATE INDEX IF NOT EXISTS "employee_movements_company_id_idx" ON "employee_movements"("company_id");
CREATE INDEX IF NOT EXISTS "employee_movements_company_id_employee_id_idx" ON "employee_movements"("company_id", "employee_id");

CREATE INDEX IF NOT EXISTS "employee_custom_allowances_tenant_id_idx" ON "employee_custom_allowances"("tenant_id");
CREATE INDEX IF NOT EXISTS "employee_custom_allowances_company_id_idx" ON "employee_custom_allowances"("company_id");
CREATE INDEX IF NOT EXISTS "employee_custom_allowances_company_id_employee_id_idx" ON "employee_custom_allowances"("company_id", "employee_id");

CREATE INDEX IF NOT EXISTS "employee_deductions_tenant_id_idx" ON "employee_deductions"("tenant_id");
CREATE INDEX IF NOT EXISTS "employee_deductions_company_id_idx" ON "employee_deductions"("company_id");
CREATE INDEX IF NOT EXISTS "employee_deductions_company_id_employee_id_idx" ON "employee_deductions"("company_id", "employee_id");

ALTER TABLE "leaves" ADD CONSTRAINT "leaves_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leaves" ADD CONSTRAINT "leaves_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_residencies" ADD CONSTRAINT "employee_residencies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_residencies" ADD CONSTRAINT "employee_residencies_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_residencies" ADD CONSTRAINT "employee_residencies_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_movements" ADD CONSTRAINT "employee_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_movements" ADD CONSTRAINT "employee_movements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_custom_allowances" ADD CONSTRAINT "employee_custom_allowances_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_custom_allowances" ADD CONSTRAINT "employee_custom_allowances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "employee_deductions" ADD CONSTRAINT "employee_deductions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_deductions" ADD CONSTRAINT "employee_deductions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

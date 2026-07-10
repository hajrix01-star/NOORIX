-- Expense lines foundation table.
-- Placed before expense-line enrichment migrations that add reference and coverage fields.

CREATE TABLE IF NOT EXISTS "expense_lines" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "name_en" TEXT,
  "kind" TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "service_number" TEXT,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "expense_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "expense_lines_tenant_id_idx" ON "expense_lines"("tenant_id");
CREATE INDEX IF NOT EXISTS "expense_lines_company_id_idx" ON "expense_lines"("company_id");
CREATE INDEX IF NOT EXISTS "expense_lines_company_id_kind_idx" ON "expense_lines"("company_id", "kind");
CREATE INDEX IF NOT EXISTS "expense_lines_company_id_category_id_idx" ON "expense_lines"("company_id", "category_id");
CREATE INDEX IF NOT EXISTS "expense_lines_company_id_supplier_id_idx" ON "expense_lines"("company_id", "supplier_id");

ALTER TABLE "expense_lines"
  ADD CONSTRAINT "expense_lines_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "expense_lines"
  ADD CONSTRAINT "expense_lines_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "expense_lines"
  ADD CONSTRAINT "expense_lines_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

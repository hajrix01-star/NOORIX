-- Operational staging register for historical supplier debts.
-- Records in this table are deliberately outside the accounting/reporting core
-- until they are promoted through the existing purchases batch transaction.
CREATE TABLE "purchase_debt_records" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "supplier_id" TEXT NOT NULL,
  "supplier_invoice_number" TEXT NOT NULL,
  "normalized_invoice_key" TEXT NOT NULL,
  "invoice_date" TIMESTAMP(3) NOT NULL,
  "total_amount" DECIMAL(18,4) NOT NULL,
  "is_taxable" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "created_by_user_id" TEXT NOT NULL,
  "promoted_by_user_id" TEXT,
  "promoted_at" TIMESTAMP(3),
  "promoted_invoice_id" TEXT,
  "promotion_batch_id" TEXT,
  "promotion_idempotency_key" TEXT,
  "promotion_invoice_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "purchase_debt_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_debt_records_amount_positive" CHECK ("total_amount" > 0),
  CONSTRAINT "purchase_debt_records_status_valid" CHECK ("status" IN ('pending', 'promoting', 'promoted', 'cancelled')),
  CONSTRAINT "purchase_debt_records_promotion_consistent" CHECK (
    ("status" = 'promoted' AND "promoted_at" IS NOT NULL AND "promoted_invoice_id" IS NOT NULL
      AND "promotion_batch_id" IS NOT NULL AND cardinality("promotion_invoice_ids") > 0)
    OR ("status" <> 'promoted' AND "promoted_at" IS NULL AND "promoted_by_user_id" IS NULL
      AND "promoted_invoice_id" IS NULL AND "promotion_batch_id" IS NULL
      AND "promotion_idempotency_key" IS NULL AND cardinality("promotion_invoice_ids") = 0)
  )
);

CREATE UNIQUE INDEX "purchase_debt_records_company_id_supplier_id_normalized_invoice_key_key"
  ON "purchase_debt_records"("company_id", "supplier_id", "normalized_invoice_key");
CREATE UNIQUE INDEX "purchase_debt_records_promoted_invoice_id_key"
  ON "purchase_debt_records"("promoted_invoice_id");
CREATE INDEX "purchase_debt_records_tenant_id_idx" ON "purchase_debt_records"("tenant_id");
CREATE INDEX "purchase_debt_records_company_id_status_invoice_date_idx"
  ON "purchase_debt_records"("company_id", "status", "invoice_date");
CREATE INDEX "purchase_debt_records_company_id_promoted_at_idx"
  ON "purchase_debt_records"("company_id", "promoted_at");
CREATE INDEX "purchase_debt_records_company_id_promotion_idempotency_key_idx"
  ON "purchase_debt_records"("company_id", "promotion_idempotency_key");
CREATE INDEX "purchase_debt_records_company_id_supplier_id_idx"
  ON "purchase_debt_records"("company_id", "supplier_id");

ALTER TABLE "purchase_debt_records"
  ADD CONSTRAINT "purchase_debt_records_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_debt_records"
  ADD CONSTRAINT "purchase_debt_records_supplier_id_fkey"
  FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_debt_records"
  ADD CONSTRAINT "purchase_debt_records_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_debt_records"
  ADD CONSTRAINT "purchase_debt_records_promoted_by_user_id_fkey"
  FOREIGN KEY ("promoted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_debt_records"
  ADD CONSTRAINT "purchase_debt_records_promoted_invoice_id_fkey"
  FOREIGN KEY ("promoted_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "purchase_debt_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_debt_records_tenant_select" ON "purchase_debt_records"
  FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "purchase_debt_records_tenant_insert" ON "purchase_debt_records"
  FOR INSERT WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "purchase_debt_records_tenant_update" ON "purchase_debt_records"
  FOR UPDATE USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "purchase_debt_records_tenant_delete" ON "purchase_debt_records"
  FOR DELETE USING ("tenant_id" = current_tenant_id());

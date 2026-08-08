CREATE TABLE "loan_legacy_invoices" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "source_expense_line_id" TEXT NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "transaction_date" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loan_legacy_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loan_legacy_invoices_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "loan_legacy_invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "loan_legacy_invoices_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "loan_legacy_invoices_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "loan_legacy_invoices_invoice_id_key" ON "loan_legacy_invoices"("invoice_id");
CREATE INDEX "loan_legacy_invoices_tenant_id_idx" ON "loan_legacy_invoices"("tenant_id");
CREATE INDEX "loan_legacy_invoices_company_id_loan_id_transaction_date_idx" ON "loan_legacy_invoices"("company_id", "loan_id", "transaction_date");

ALTER TABLE "loan_legacy_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "loan_legacy_invoices" FORCE ROW LEVEL SECURITY;
CREATE POLICY "loan_legacy_invoices_tenant_select" ON "loan_legacy_invoices" FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "loan_legacy_invoices_tenant_insert" ON "loan_legacy_invoices" FOR INSERT WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "loan_legacy_invoices_tenant_update" ON "loan_legacy_invoices" FOR UPDATE USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "loan_legacy_invoices_tenant_delete" ON "loan_legacy_invoices" FOR DELETE USING ("tenant_id" = current_tenant_id());

-- Reclassify historical loan invoices safely: retain the original document,
-- cancel its expense effect, and record the replacement loan payment traceably.
ALTER TABLE "loan_payments"
  ADD COLUMN "source_invoice_id" TEXT,
  ADD COLUMN "source_ledger_entry_id" TEXT;

ALTER TABLE "loan_legacy_invoices"
  ADD COLUMN "converted_at" TIMESTAMP(3),
  ADD COLUMN "converted_by_id" TEXT;

ALTER TABLE "loan_payments"
  ADD CONSTRAINT "loan_payments_source_invoice_id_fkey"
    FOREIGN KEY ("source_invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "loan_payments_source_ledger_entry_id_fkey"
    FOREIGN KEY ("source_ledger_entry_id") REFERENCES "ledger_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "loan_payments_source_ledger_entry_id_key"
  ON "loan_payments"("source_ledger_entry_id");
CREATE INDEX "loan_payments_company_id_source_invoice_id_idx"
  ON "loan_payments"("company_id", "source_invoice_id");
CREATE INDEX "loan_legacy_invoices_company_id_loan_id_converted_at_idx"
  ON "loan_legacy_invoices"("company_id", "loan_id", "converted_at");

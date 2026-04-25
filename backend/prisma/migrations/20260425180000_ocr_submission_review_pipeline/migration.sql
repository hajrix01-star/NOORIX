-- OCR submission pipeline: submitter, extraction error, optional link to purchase invoice

ALTER TABLE "ocr_invoices" ADD COLUMN "submitted_by_user_id" TEXT;
ALTER TABLE "ocr_invoices" ADD COLUMN "extraction_error" TEXT;
ALTER TABLE "ocr_invoices" ADD COLUMN "linked_purchase_invoice_id" TEXT;

ALTER TABLE "ocr_invoices"
  ADD CONSTRAINT "ocr_invoices_submitted_by_user_id_fkey"
  FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ocr_invoices"
  ADD CONSTRAINT "ocr_invoices_linked_purchase_invoice_id_fkey"
  FOREIGN KEY ("linked_purchase_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ocr_invoices_submitted_by_user_id_idx" ON "ocr_invoices"("submitted_by_user_id");
CREATE INDEX IF NOT EXISTS "ocr_invoices_linked_purchase_invoice_id_idx" ON "ocr_invoices"("linked_purchase_invoice_id");
CREATE INDEX IF NOT EXISTS "ocr_invoices_company_id_status_idx" ON "ocr_invoices"("company_id", "status");

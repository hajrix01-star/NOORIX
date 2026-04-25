-- OCR: scope suppliers/items/invoices and related tables by company_id
-- Backfill: first non-archived company per tenant (by created_at)

-- 1) ocr_suppliers
ALTER TABLE "ocr_suppliers" ADD COLUMN "company_id" TEXT;
UPDATE "ocr_suppliers" s
SET "company_id" = (
  SELECT c.id FROM "companies" c
  WHERE c.tenant_id = s.tenant_id AND c.is_archived = false
  ORDER BY c.created_at ASC LIMIT 1
)
WHERE s.company_id IS NULL;
ALTER TABLE "ocr_suppliers" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "ocr_suppliers"
  ADD CONSTRAINT "ocr_suppliers_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ocr_suppliers_tenant_id_company_id_idx" ON "ocr_suppliers"("tenant_id", "company_id");

-- 2) ocr_items
ALTER TABLE "ocr_items" ADD COLUMN "company_id" TEXT;
UPDATE "ocr_items" i
SET "company_id" = (
  SELECT c.id FROM "companies" c
  WHERE c.tenant_id = i.tenant_id AND c.is_archived = false
  ORDER BY c.created_at ASC LIMIT 1
)
WHERE i.company_id IS NULL;
ALTER TABLE "ocr_items" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "ocr_items"
  ADD CONSTRAINT "ocr_items_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ocr_items_tenant_id_company_id_idx" ON "ocr_items"("tenant_id", "company_id");

-- 3) ocr_invoices (prefer supplier's company, else tenant default)
ALTER TABLE "ocr_invoices" ADD COLUMN "company_id" TEXT;
UPDATE "ocr_invoices" inv
SET "company_id" = COALESCE(
  (SELECT s.company_id FROM "ocr_suppliers" s WHERE s.id = inv.supplier_id),
  (SELECT c.id FROM "companies" c
   WHERE c.tenant_id = inv.tenant_id AND c.is_archived = false
   ORDER BY c.created_at ASC LIMIT 1)
)
WHERE inv.company_id IS NULL;
ALTER TABLE "ocr_invoices" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "ocr_invoices"
  ADD CONSTRAINT "ocr_invoices_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ocr_invoices_tenant_id_company_id_idx" ON "ocr_invoices"("tenant_id", "company_id");

-- 4) ocr_price_history
ALTER TABLE "ocr_price_history" ADD COLUMN "company_id" TEXT;
UPDATE "ocr_price_history" h
SET "company_id" = COALESCE(
  (SELECT i.company_id FROM "ocr_items" i WHERE i.id = h.item_id),
  (SELECT s.company_id FROM "ocr_suppliers" s WHERE s.id = h.supplier_id),
  (SELECT c.id FROM "companies" c
   WHERE c.tenant_id = h.tenant_id AND c.is_archived = false
   ORDER BY c.created_at ASC LIMIT 1)
)
WHERE h.company_id IS NULL;
ALTER TABLE "ocr_price_history" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "ocr_price_history"
  ADD CONSTRAINT "ocr_price_history_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ocr_price_history_tenant_id_company_id_idx" ON "ocr_price_history"("tenant_id", "company_id");

-- 5) ocr_correction_rules
ALTER TABLE "ocr_correction_rules" ADD COLUMN "company_id" TEXT;
UPDATE "ocr_correction_rules" r
SET "company_id" = COALESCE(
  (SELECT s.company_id FROM "ocr_suppliers" s WHERE s.id = r.supplier_id),
  (SELECT c.id FROM "companies" c
   WHERE c.tenant_id = r.tenant_id AND c.is_archived = false
   ORDER BY c.created_at ASC LIMIT 1)
)
WHERE r.company_id IS NULL;
ALTER TABLE "ocr_correction_rules" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "ocr_correction_rules"
  ADD CONSTRAINT "ocr_correction_rules_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ocr_correction_rules_tenant_id_company_id_idx" ON "ocr_correction_rules"("tenant_id", "company_id");

-- 6) ocr_extraction_logs
ALTER TABLE "ocr_extraction_logs" ADD COLUMN "company_id" TEXT;
UPDATE "ocr_extraction_logs" e
SET "company_id" = COALESCE(
  (SELECT s.company_id FROM "ocr_suppliers" s WHERE s.id = e.supplier_id),
  (SELECT c.id FROM "companies" c
   WHERE c.tenant_id = e.tenant_id AND c.is_archived = false
   ORDER BY c.created_at ASC LIMIT 1)
)
WHERE e.company_id IS NULL;
ALTER TABLE "ocr_extraction_logs" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "ocr_extraction_logs"
  ADD CONSTRAINT "ocr_extraction_logs_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX IF NOT EXISTS "ocr_extraction_logs_tenant_id_company_id_idx" ON "ocr_extraction_logs"("tenant_id", "company_id");

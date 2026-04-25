-- ربط مورد OCR بمورد المحاسبة (اختياري)
ALTER TABLE "ocr_suppliers" ADD COLUMN IF NOT EXISTS "accounting_supplier_id" TEXT;

CREATE INDEX IF NOT EXISTS "ocr_suppliers_accounting_supplier_id_idx" ON "ocr_suppliers"("accounting_supplier_id");

ALTER TABLE "ocr_suppliers"
  DROP CONSTRAINT IF EXISTS "ocr_suppliers_accounting_supplier_id_fkey";

ALTER TABLE "ocr_suppliers"
  ADD CONSTRAINT "ocr_suppliers_accounting_supplier_id_fkey"
  FOREIGN KEY ("accounting_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop the retired experimental OCR invoice feature tables.
-- The product owner confirmed this data is experimental and does not need retention.
DROP TABLE IF EXISTS "ocr_extraction_logs" CASCADE;
DROP TABLE IF EXISTS "ocr_correction_rules" CASCADE;
DROP TABLE IF EXISTS "ocr_price_history" CASCADE;
DROP TABLE IF EXISTS "ocr_invoice_lines" CASCADE;
DROP TABLE IF EXISTS "ocr_invoices" CASCADE;
DROP TABLE IF EXISTS "ocr_item_aliases" CASCADE;
DROP TABLE IF EXISTS "ocr_items" CASCADE;
DROP TABLE IF EXISTS "ocr_supplier_aliases" CASCADE;
DROP TABLE IF EXISTS "ocr_suppliers" CASCADE;

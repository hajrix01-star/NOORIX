-- Add bilingual names and size/variant support to OCR module

-- ocr_invoice_lines: add nameAr, nameEn, size, size_unit
ALTER TABLE "ocr_invoice_lines"
  ADD COLUMN IF NOT EXISTS "name_ar"    TEXT,
  ADD COLUMN IF NOT EXISTS "name_en"    TEXT,
  ADD COLUMN IF NOT EXISTS "size"       TEXT,
  ADD COLUMN IF NOT EXISTS "size_unit"  TEXT;

-- ocr_price_history: add size so price is tracked per item+size combination
ALTER TABLE "ocr_price_history"
  ADD COLUMN IF NOT EXISTS "size"       TEXT,
  ADD COLUMN IF NOT EXISTS "size_unit"  TEXT;

-- ocr_items: nameEn already exists, add canonical_size for default display
ALTER TABLE "ocr_items"
  ADD COLUMN IF NOT EXISTS "has_sizes"  BOOLEAN NOT NULL DEFAULT false;

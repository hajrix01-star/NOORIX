-- Add sections column to order_products
-- sections = JSON array of section names, e.g. ["مطبخ","بار"]
-- NULL means the product is visible to ALL sections (backwards compatible)
ALTER TABLE "order_products" ADD COLUMN IF NOT EXISTS "sections" JSONB;

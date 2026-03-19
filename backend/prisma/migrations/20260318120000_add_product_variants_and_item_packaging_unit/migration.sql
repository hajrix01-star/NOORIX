-- Add variants JSON column to order_products
ALTER TABLE "order_products" ADD COLUMN IF NOT EXISTS "variants" JSONB;

-- Add packaging and unit columns to order_items
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "packaging" TEXT;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unit" TEXT;

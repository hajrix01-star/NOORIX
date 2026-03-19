-- Ensure sizes and packaging columns exist on order_products
ALTER TABLE "order_products" ADD COLUMN IF NOT EXISTS "sizes" TEXT;
ALTER TABLE "order_products" ADD COLUMN IF NOT EXISTS "packaging" TEXT;

-- Ensure size column exists on order_items
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "size" TEXT;

ALTER TABLE "order_products"
ADD COLUMN IF NOT EXISTS "inventory_conversions" JSONB;

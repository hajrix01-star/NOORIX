-- Add productType to order_products (order | sale)
ALTER TABLE "order_products" ADD COLUMN IF NOT EXISTS "product_type" TEXT NOT NULL DEFAULT 'order';

-- Add orderType to staff_orders (order | sale)
ALTER TABLE "staff_orders" ADD COLUMN IF NOT EXISTS "order_type" TEXT NOT NULL DEFAULT 'order';

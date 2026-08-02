ALTER TABLE "orders_v4_item_units"
  ADD COLUMN IF NOT EXISTS "purchase_label" TEXT;

CREATE INDEX IF NOT EXISTS "orders_inventory_projection_idx"
ON "orders" ("company_id", "status", "order_date", "id");

CREATE INDEX IF NOT EXISTS "order_items_inventory_snapshot_idx"
ON "order_items" ("order_id", "product_id")
WHERE "inventory_base_quantity_snapshot" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "order_items_inventory_legacy_idx"
ON "order_items" ("order_id", "product_id")
WHERE "inventory_base_quantity_snapshot" IS NULL;

CREATE INDEX IF NOT EXISTS "staff_orders_inventory_projection_idx"
ON "staff_orders" ("company_id", "order_type", "status", "sale_date", "id");

CREATE INDEX IF NOT EXISTS "staff_order_items_inventory_snapshot_idx"
ON "staff_order_items" ("staff_order_id", "product_id")
WHERE "inventory_consumption_snapshot" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "staff_order_items_inventory_legacy_idx"
ON "staff_order_items" ("staff_order_id", "product_id")
WHERE "inventory_consumption_snapshot" IS NULL;

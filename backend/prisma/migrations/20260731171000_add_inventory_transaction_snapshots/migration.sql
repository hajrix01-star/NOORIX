ALTER TABLE "order_items"
ADD COLUMN "inventory_base_quantity_snapshot" DECIMAL(18, 6);

ALTER TABLE "staff_order_items"
ADD COLUMN "inventory_consumption_snapshot" JSONB;

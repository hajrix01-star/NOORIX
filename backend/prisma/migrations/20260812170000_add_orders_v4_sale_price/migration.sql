-- The purchase price and the selling price are different business facts.
-- Keep existing historical registrations unchanged: their line price is already
-- a snapshot and must never be inferred from a price configured today.
ALTER TABLE "orders_v4_item_units"
  ADD COLUMN "sale_price" DECIMAL(20,6);

ALTER TABLE "orders_v4_item_units"
  ADD CONSTRAINT "orders_v4_item_units_sale_price_check"
  CHECK ("sale_price" IS NULL OR "sale_price" >= 0);

-- Existing registration items are sale products. Their configured price is
-- carried forward once as the opening selling price, without changing the
-- purchase-price snapshot or any historical registration document.
-- A zero/missing price remains unset so a new registration cannot silently
-- invent revenue for that item.
UPDATE "orders_v4_item_units" AS unit
SET "sale_price" = unit."last_price"
FROM "orders_v4_items" AS item
WHERE item."id" = unit."item_id"
  AND item."item_type" = 'sale'
  AND unit."last_price" > 0
  AND unit."sale_price" IS NULL;

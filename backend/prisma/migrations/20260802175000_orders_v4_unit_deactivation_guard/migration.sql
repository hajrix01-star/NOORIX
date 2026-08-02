-- Database-owned guard: a historical/current V4 unit must never be disabled while referenced.
CREATE OR REPLACE FUNCTION orders_v4_guard_unit_deactivation() RETURNS trigger AS $$
BEGIN
  IF OLD."is_active" = TRUE AND NEW."is_active" = FALSE AND (
    EXISTS (SELECT 1 FROM "orders_v4_items" WHERE "inventory_unit_id" = OLD."id") OR
    EXISTS (SELECT 1 FROM "orders_v4_item_units" WHERE "unit_id" = OLD."id") OR
    EXISTS (SELECT 1 FROM "orders_v4_conversion_edges" WHERE "from_unit_id" = OLD."id" OR "to_unit_id" = OLD."id") OR
    EXISTS (SELECT 1 FROM "orders_v4_recipe_versions" WHERE "output_unit_id" = OLD."id") OR
    EXISTS (SELECT 1 FROM "orders_v4_recipe_lines" WHERE "unit_id" = OLD."id") OR
    EXISTS (SELECT 1 FROM "orders_v4_document_lines" WHERE "input_unit_id" = OLD."id" OR "base_unit_id" = OLD."id" OR "price_unit_id" = OLD."id") OR
    EXISTS (SELECT 1 FROM "orders_v4_price_history" WHERE "unit_id" = OLD."id" OR "inventory_unit_id" = OLD."id") OR
    EXISTS (SELECT 1 FROM "orders_v4_inventory_ledger" WHERE "inventory_unit_id" = OLD."id") OR
    EXISTS (SELECT 1 FROM "orders_v4_stocktake_lines" WHERE "unit_id" = OLD."id")
  ) THEN
    RAISE EXCEPTION 'Orders V4 referenced unit cannot be deactivated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_v4_unit_deactivation_guard ON "orders_v4_units";
CREATE TRIGGER orders_v4_unit_deactivation_guard
  BEFORE UPDATE OF "is_active" ON "orders_v4_units"
  FOR EACH ROW EXECUTE FUNCTION orders_v4_guard_unit_deactivation();

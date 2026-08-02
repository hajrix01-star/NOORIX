-- Preserve effective access by translating every Orders V3 permission to its
-- Orders V4 equivalent before the obsolete permission keys disappear.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "order_products" AS source
    WHERE NOT EXISTS (
      SELECT 1 FROM "orders_v4_migration_map" AS map
      WHERE map."company_id" = source."company_id"
        AND map."source_system" = 'legacy-orders'
        AND map."source_entity" = 'OrderProduct'
        AND map."source_id" = source."id"
        AND map."status" = 'verified'
    )
  ) OR EXISTS (
    SELECT 1 FROM "orders" AS source
    WHERE NOT EXISTS (
      SELECT 1 FROM "orders_v4_migration_map" AS map
      WHERE map."company_id" = source."company_id"
        AND map."source_system" = 'legacy-orders'
        AND map."source_entity" = 'Order'
        AND map."source_id" = source."id"
        AND map."status" = 'verified'
    )
  ) OR EXISTS (
    SELECT 1 FROM "staff_orders" AS source
    WHERE source."order_type" = 'sale'
      AND NOT EXISTS (
        SELECT 1 FROM "orders_v4_migration_map" AS map
        WHERE map."company_id" = source."company_id"
          AND map."source_system" = 'legacy-orders'
          AND map."source_entity" = 'StaffOrder'
          AND map."source_id" = source."id"
          AND map."status" = 'verified'
      )
  ) THEN
    RAISE EXCEPTION 'Orders V4 cutover coverage is incomplete; Orders V3 removal aborted';
  END IF;
END $$;

UPDATE "roles" AS role
SET "permissions" = (
  SELECT COALESCE(array_agg(DISTINCT permission ORDER BY permission), ARRAY[]::text[]) AS permissions
  FROM (
    SELECT CASE source_permission
      WHEN 'VIEW_ORDERS_V3' THEN 'VIEW_ORDERS_V4'
      WHEN 'ORDERS_V3_READ' THEN 'ORDERS_V4_READ'
      WHEN 'ORDERS_V3_WRITE' THEN 'ORDERS_V4_WRITE'
      WHEN 'ORDERS_V3_DELETE' THEN 'ORDERS_V4_DELETE'
      WHEN 'ORDERS_V3_STAFF_SUBMIT' THEN 'ORDERS_V4_STAFF_SUBMIT'
      WHEN 'ORDERS_V3_INTERNAL_SUBMIT' THEN 'ORDERS_V4_INTERNAL_SUBMIT'
      WHEN 'ORDERS_V3_REPORTS_READ' THEN 'ORDERS_V4_REPORTS_READ'
      WHEN 'ORDERS_V3_INVENTORY_WRITE' THEN 'ORDERS_V4_INVENTORY_WRITE'
      ELSE source_permission
    END AS permission
    FROM unnest(role."permissions") AS source_permission
  ) translated
);

UPDATE "roles" AS role
SET "last_seed_permissions" = (
  SELECT COALESCE(array_agg(DISTINCT permission ORDER BY permission), ARRAY[]::text[]) AS permissions
  FROM (
    SELECT CASE source_permission
      WHEN 'VIEW_ORDERS_V3' THEN 'VIEW_ORDERS_V4'
      WHEN 'ORDERS_V3_READ' THEN 'ORDERS_V4_READ'
      WHEN 'ORDERS_V3_WRITE' THEN 'ORDERS_V4_WRITE'
      WHEN 'ORDERS_V3_DELETE' THEN 'ORDERS_V4_DELETE'
      WHEN 'ORDERS_V3_STAFF_SUBMIT' THEN 'ORDERS_V4_STAFF_SUBMIT'
      WHEN 'ORDERS_V3_INTERNAL_SUBMIT' THEN 'ORDERS_V4_INTERNAL_SUBMIT'
      WHEN 'ORDERS_V3_REPORTS_READ' THEN 'ORDERS_V4_REPORTS_READ'
      WHEN 'ORDERS_V3_INVENTORY_WRITE' THEN 'ORDERS_V4_INVENTORY_WRITE'
      ELSE source_permission
    END AS permission
    FROM unnest(role."last_seed_permissions") AS source_permission
  ) translated
);

DROP TABLE IF EXISTS
  "orders_v3_stocktake_lines",
  "orders_v3_stocktakes",
  "orders_v3_ledger_entries",
  "orders_v3_document_lines",
  "orders_v3_documents",
  "orders_v3_recipe_lines",
  "orders_v3_recipe_versions",
  "orders_v3_conversion_edges",
  "orders_v3_conversion_versions",
  "orders_v3_item_sections",
  "orders_v3_locations",
  "orders_v3_items",
  "orders_v3_sections",
  "orders_v3_categories",
  "orders_v3_units",
  "orders_v3_migration_map"
CASCADE;

DROP FUNCTION IF EXISTS orders_v3_reject_mutation();
DROP FUNCTION IF EXISTS orders_v3_validate_scope();

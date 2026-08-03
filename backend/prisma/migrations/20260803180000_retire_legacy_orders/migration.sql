-- Permanently retire legacy Orders only after every source row has a verified,
-- company-scoped Orders V4 destination. This migration is deliberately
-- fail-closed: any missing mapping, target or line aborts the whole deployment.

CREATE TABLE "orders_v4_legacy_archives" (
  "id" text NOT NULL,
  "tenant_id" text NOT NULL,
  "company_id" text NOT NULL,
  "source_system" text NOT NULL,
  "source_table" text NOT NULL,
  "source_id" text NOT NULL,
  "source_checksum" text NOT NULL,
  "payload" jsonb NOT NULL,
  "archived_at" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_v4_legacy_archives_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v4_legacy_archives_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "orders_v4_legacy_archives_company_source_key"
  ON "orders_v4_legacy_archives"("company_id", "source_system", "source_table", "source_id");
CREATE INDEX "orders_v4_legacy_archives_tenant_id_idx"
  ON "orders_v4_legacy_archives"("tenant_id");
CREATE INDEX "orders_v4_legacy_archives_company_source_idx"
  ON "orders_v4_legacy_archives"("company_id", "source_system", "source_table");

CREATE TRIGGER orders_v4_legacy_archives_scope
  BEFORE INSERT OR UPDATE ON "orders_v4_legacy_archives"
  FOR EACH ROW EXECUTE FUNCTION orders_v4_validate_scope();
CREATE TRIGGER orders_v4_legacy_archives_immutable
  BEFORE UPDATE OR DELETE ON "orders_v4_legacy_archives"
  FOR EACH ROW EXECUTE FUNCTION orders_v4_reject_mutation();
ALTER TABLE "orders_v4_legacy_archives" ENABLE ROW LEVEL SECURITY;
CREATE POLICY orders_v4_legacy_archives_tenant_select ON "orders_v4_legacy_archives"
  FOR SELECT USING (tenant_id = current_tenant_id());
CREATE POLICY orders_v4_legacy_archives_tenant_insert ON "orders_v4_legacy_archives"
  FOR INSERT WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY orders_v4_legacy_archives_tenant_update ON "orders_v4_legacy_archives"
  FOR UPDATE USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id());
CREATE POLICY orders_v4_legacy_archives_tenant_delete ON "orders_v4_legacy_archives"
  FOR DELETE USING (tenant_id = current_tenant_id());

LOCK TABLE
  "order_categories", "order_sections", "order_catalog_units", "order_conversion_templates",
  "order_products", "orders", "order_items", "staff_orders", "staff_order_items",
  "inventory_stocktakes", "inventory_stocktake_lines", "inventory_movements",
  "inventory_locations_v2", "inventory_definition_versions_v2", "inventory_ledger_entries_v2",
  "shisha_inventory_settings", "shisha_inventory_movements", "shisha_stocktakes"
IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "companies" company
    WHERE EXISTS (
      SELECT 1 FROM "staff_orders" source
      WHERE source."company_id" = company."id"
    ) AND NOT EXISTS (
      SELECT 1 FROM "orders_v4_locations" target
      WHERE target."company_id" = company."id" AND target."is_active" = true
    )
  ) THEN
    RAISE EXCEPTION 'Legacy Orders retirement aborted: an affected company has no active Orders V4 location';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "staff_order_items" line
    JOIN "staff_orders" source ON source."id" = line."staff_order_id"
    LEFT JOIN "orders_v4_migration_map" map
      ON map."company_id" = source."company_id"
     AND map."source_system" = 'legacy-orders'
     AND map."source_entity" = 'OrderProduct'
     AND map."source_id" = line."product_id"
     AND map."status" = 'verified'
    LEFT JOIN "orders_v4_items" target
      ON target."id" = map."target_id" AND target."company_id" = source."company_id"
    WHERE target."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Legacy Orders retirement aborted: a staff line has no verified Orders V4 item';
  END IF;
END $$;

-- The Shisha-specific ledger was superseded before V4 and no longer affects
-- operational balances. Preserve every source row byte-for-byte as JSONB audit
-- evidence, then prove count and checksum parity before removing its tables.
INSERT INTO "orders_v4_legacy_archives" (
  "id", "tenant_id", "company_id", "source_system", "source_table",
  "source_id", "source_checksum", "payload", "archived_at"
)
SELECT
  'legacy-archive-' || md5('shisha_inventory_settings:' || source."company_id" || ':' || source."id"),
  source."tenant_id", source."company_id", 'legacy-orders-shisha', 'shisha_inventory_settings',
  source."id", md5(to_jsonb(source)::text), to_jsonb(source), now()
FROM "shisha_inventory_settings" source
ON CONFLICT ("company_id", "source_system", "source_table", "source_id") DO NOTHING;

INSERT INTO "orders_v4_legacy_archives" (
  "id", "tenant_id", "company_id", "source_system", "source_table",
  "source_id", "source_checksum", "payload", "archived_at"
)
SELECT
  'legacy-archive-' || md5('shisha_inventory_movements:' || source."company_id" || ':' || source."id"),
  source."tenant_id", source."company_id", 'legacy-orders-shisha', 'shisha_inventory_movements',
  source."id", md5(to_jsonb(source)::text), to_jsonb(source), now()
FROM "shisha_inventory_movements" source
ON CONFLICT ("company_id", "source_system", "source_table", "source_id") DO NOTHING;

INSERT INTO "orders_v4_legacy_archives" (
  "id", "tenant_id", "company_id", "source_system", "source_table",
  "source_id", "source_checksum", "payload", "archived_at"
)
SELECT
  'legacy-archive-' || md5('shisha_stocktakes:' || source."company_id" || ':' || source."id"),
  source."tenant_id", source."company_id", 'legacy-orders-shisha', 'shisha_stocktakes',
  source."id", md5(to_jsonb(source)::text), to_jsonb(source), now()
FROM "shisha_stocktakes" source
ON CONFLICT ("company_id", "source_system", "source_table", "source_id") DO NOTHING;

DO $$
BEGIN
  IF (SELECT count(*) FROM "shisha_inventory_settings") <>
     (SELECT count(*) FROM "orders_v4_legacy_archives" WHERE "source_system" = 'legacy-orders-shisha' AND "source_table" = 'shisha_inventory_settings')
  OR (SELECT count(*) FROM "shisha_inventory_movements") <>
     (SELECT count(*) FROM "orders_v4_legacy_archives" WHERE "source_system" = 'legacy-orders-shisha' AND "source_table" = 'shisha_inventory_movements')
  OR (SELECT count(*) FROM "shisha_stocktakes") <>
     (SELECT count(*) FROM "orders_v4_legacy_archives" WHERE "source_system" = 'legacy-orders-shisha' AND "source_table" = 'shisha_stocktakes')
  OR EXISTS (
    SELECT 1 FROM "shisha_inventory_settings" source
    LEFT JOIN "orders_v4_legacy_archives" archive
      ON archive."company_id" = source."company_id" AND archive."source_system" = 'legacy-orders-shisha'
     AND archive."source_table" = 'shisha_inventory_settings' AND archive."source_id" = source."id"
    WHERE archive."source_checksum" IS DISTINCT FROM md5(to_jsonb(source)::text)
  )
  OR EXISTS (
    SELECT 1 FROM "shisha_inventory_movements" source
    LEFT JOIN "orders_v4_legacy_archives" archive
      ON archive."company_id" = source."company_id" AND archive."source_system" = 'legacy-orders-shisha'
     AND archive."source_table" = 'shisha_inventory_movements' AND archive."source_id" = source."id"
    WHERE archive."source_checksum" IS DISTINCT FROM md5(to_jsonb(source)::text)
  )
  OR EXISTS (
    SELECT 1 FROM "shisha_stocktakes" source
    LEFT JOIN "orders_v4_legacy_archives" archive
      ON archive."company_id" = source."company_id" AND archive."source_system" = 'legacy-orders-shisha'
     AND archive."source_table" = 'shisha_stocktakes' AND archive."source_id" = source."id"
    WHERE archive."source_checksum" IS DISTINCT FROM md5(to_jsonb(source)::text)
  ) THEN
    RAISE EXCEPTION 'Legacy Orders retirement aborted: Shisha archive parity failed';
  END IF;
END $$;

-- Catalog governance rows that no longer have a live V4 target are historical
-- configuration, not operational stock. Preserve those exact rows in the
-- immutable archive instead of resurrecting categories/sections/units that a
-- user deliberately removed after cutover.
INSERT INTO "orders_v4_legacy_archives" (
  "id", "tenant_id", "company_id", "source_system", "source_table",
  "source_id", "source_checksum", "payload", "archived_at"
)
SELECT
  'legacy-archive-' || md5('order_categories:' || source."company_id" || ':' || source."id"),
  source."tenant_id", source."company_id", 'legacy-orders-catalog', 'order_categories',
  source."id", md5(to_jsonb(source)::text), to_jsonb(source), now()
FROM "order_categories" source
WHERE NOT EXISTS (
  SELECT 1 FROM "orders_v4_migration_map" map
  JOIN "orders_v4_categories" target
    ON target."id" = map."target_id" AND target."company_id" = source."company_id"
  WHERE map."company_id" = source."company_id" AND map."source_system" = 'legacy-orders'
    AND map."source_entity" = 'OrderCategory' AND map."source_id" = source."id"
    AND map."status" = 'verified'
)
ON CONFLICT ("company_id", "source_system", "source_table", "source_id") DO NOTHING;

INSERT INTO "orders_v4_legacy_archives" (
  "id", "tenant_id", "company_id", "source_system", "source_table",
  "source_id", "source_checksum", "payload", "archived_at"
)
SELECT
  'legacy-archive-' || md5('order_sections:' || source."company_id" || ':' || source."id"),
  source."tenant_id", source."company_id", 'legacy-orders-catalog', 'order_sections',
  source."id", md5(to_jsonb(source)::text), to_jsonb(source), now()
FROM "order_sections" source
WHERE NOT EXISTS (
  SELECT 1 FROM "orders_v4_migration_map" map
  JOIN "orders_v4_sections" target
    ON target."id" = map."target_id" AND target."company_id" = source."company_id"
  WHERE map."company_id" = source."company_id" AND map."source_system" = 'legacy-orders'
    AND map."source_entity" = 'OrderSection' AND map."source_id" = source."id"
    AND map."status" = 'verified'
)
ON CONFLICT ("company_id", "source_system", "source_table", "source_id") DO NOTHING;

INSERT INTO "orders_v4_legacy_archives" (
  "id", "tenant_id", "company_id", "source_system", "source_table",
  "source_id", "source_checksum", "payload", "archived_at"
)
SELECT
  'legacy-archive-' || md5('order_catalog_units:' || source."company_id" || ':' || source."id"),
  source."tenant_id", source."company_id", 'legacy-orders-catalog', 'order_catalog_units',
  source."id", md5(to_jsonb(source)::text), to_jsonb(source), now()
FROM "order_catalog_units" source
WHERE NOT EXISTS (
  SELECT 1 FROM "orders_v4_migration_map" map
  JOIN "orders_v4_units" target
    ON target."id" = map."target_id" AND target."company_id" = source."company_id"
  WHERE map."company_id" = source."company_id" AND map."source_system" = 'legacy-orders'
    AND map."source_entity" = 'OrderCatalogUnit' AND map."source_id" = source."id"
    AND map."status" = 'verified'
)
ON CONFLICT ("company_id", "source_system", "source_table", "source_id") DO NOTHING;

-- The original cutover intentionally imported only internal-sale records.
-- Preserve historical department requests as prepared V4 purchase requests and
-- preserve historical cancellation records as independent V4 cancellations.
WITH source_rows AS (
  SELECT
    source.*,
    CASE WHEN source."order_type" = 'order' THEN 'purchase' ELSE 'registration' END AS document_type,
    CASE WHEN source."order_type" = 'sale' AND source."entry_type" = 'cancellation' THEN 'cancellation' ELSE NULL END AS registration_entry_type,
    CASE WHEN source."order_type" = 'order' THEN 'prepared' ELSE 'received' END AS target_status,
    ('legacy-retired-document-' || md5(source."company_id" || ':' || source."id")) AS target_id,
    ('legacy-staff-order:' || source."id") AS target_idempotency_key,
    COALESCE(
      (SELECT section."id" FROM "orders_v4_sections" section
       WHERE section."company_id" = source."company_id"
         AND lower(btrim(section."name_ar")) = lower(btrim(source."section_name"))
       ORDER BY section."is_active" DESC, section."sort_order", section."id" LIMIT 1),
      NULL
    ) AS target_section_id,
    (SELECT location."id" FROM "orders_v4_locations" location
     WHERE location."company_id" = source."company_id" AND location."is_active" = true
     ORDER BY CASE WHEN location."code" = 'main' THEN 0 ELSE 1 END, location."created_at", location."id" LIMIT 1) AS target_location_id
  FROM "staff_orders" source
  WHERE source."order_type" = 'order'
     OR (source."order_type" = 'sale' AND source."entry_type" = 'cancellation')
), totals AS (
  SELECT
    source."id" AS source_id,
    COALESCE(sum(line."quantity" * line."unit_price"), 0)::decimal(20,6) AS total_amount
  FROM source_rows source
  LEFT JOIN "staff_order_items" line ON line."staff_order_id" = source."id"
  GROUP BY source."id"
)
INSERT INTO "orders_v4_documents" (
  "id", "tenant_id", "company_id", "document_number", "document_type",
  "registration_entry_type", "status", "payment_method", "document_date",
  "section_id", "location_id", "petty_cash_amount", "subtotal", "total_amount",
  "operational_cost", "notes", "revision", "idempotency_key", "request_hash",
  "calculation_version", "calculation_snapshot", "received_at", "received_by_user_id",
  "created_by_user_id", "updated_by_user_id", "created_at", "updated_at"
)
SELECT
  source.target_id, source."tenant_id", source."company_id",
  CASE WHEN source."order_type" = 'order' THEN 'LEGACY-REQ-' ELSE 'LEGACY-CAN-' END || upper(substr(md5(source."id"), 1, 12)),
  source.document_type, source.registration_entry_type, source.target_status,
  CASE WHEN source."order_type" = 'order' THEN 'custody' ELSE NULL END,
  COALESCE(source."sale_date", source."created_at")::date,
  source.target_section_id, source.target_location_id, NULL,
  totals.total_amount, totals.total_amount, 0, source."notes", 1,
  source.target_idempotency_key, md5(source."id"), 4,
  jsonb_build_object(
    'kernelVersion', 4,
    'sourceSystem', 'legacy-orders-retirement',
    'sourceId', source."id",
    'historicalImport', true
  ),
  CASE WHEN source."order_type" = 'sale' THEN COALESCE(source."sent_at", source."updated_at") ELSE NULL END,
  CASE WHEN source."order_type" = 'sale' THEN source."user_id" ELSE NULL END,
  source."user_id", source."user_id", source."created_at", source."updated_at"
FROM source_rows source
JOIN totals ON totals.source_id = source."id"
ON CONFLICT ("company_id", "idempotency_key") DO NOTHING;

WITH source_rows AS (
  SELECT
    source.*,
    ('legacy-retired-document-' || md5(source."company_id" || ':' || source."id")) AS target_document_id
  FROM "staff_orders" source
  WHERE source."order_type" = 'order'
     OR (source."order_type" = 'sale' AND source."entry_type" = 'cancellation')
), prepared_lines AS (
  SELECT
    line.*,
    source."tenant_id", source."company_id", source.target_document_id,
    map."target_id" AS target_item_id,
    item."inventory_unit_id" AS target_unit_id,
    COALESCE(
      (SELECT unit."id"
       FROM "orders_v4_units" unit
       WHERE unit."company_id" = source."company_id"
         AND unit."is_active" = true
         AND (
           lower(btrim(unit."code")) = lower(btrim(COALESCE(NULLIF(line."unit", ''), line."packaging", '')))
           OR lower(btrim(unit."name_ar")) = lower(btrim(COALESCE(NULLIF(line."unit", ''), line."packaging", '')))
           OR lower(btrim(COALESCE(unit."name_en", ''))) = lower(btrim(COALESCE(NULLIF(line."unit", ''), line."packaging", '')))
         )
       ORDER BY CASE WHEN lower(btrim(unit."code")) = lower(btrim(COALESCE(NULLIF(line."unit", ''), line."packaging", ''))) THEN 0 ELSE 1 END,
                unit."sort_order", unit."id"
       LIMIT 1),
      item."inventory_unit_id"
    ) AS target_input_unit_id,
    (line."quantity" * COALESCE(NULLIF(line."quantity_multiplier", 0), 1))::decimal(24,8) AS target_quantity,
    (line."quantity" * line."unit_price")::decimal(20,6) AS target_total,
    row_number() OVER (PARTITION BY source."id" ORDER BY line."created_at", line."id") AS target_line_number
  FROM source_rows source
  JOIN "staff_order_items" line ON line."staff_order_id" = source."id"
  JOIN "orders_v4_migration_map" map
    ON map."company_id" = source."company_id"
   AND map."source_system" = 'legacy-orders'
   AND map."source_entity" = 'OrderProduct'
   AND map."source_id" = line."product_id"
   AND map."status" = 'verified'
  JOIN "orders_v4_items" item ON item."id" = map."target_id" AND item."company_id" = source."company_id"
)
INSERT INTO "orders_v4_document_lines" (
  "id", "tenant_id", "company_id", "document_id", "item_id", "line_number",
  "item_name_snapshot", "input_quantity", "input_unit_id", "base_quantity", "base_unit_id",
  "unit_price", "price_unit_id", "price_quantity", "line_total", "operational_cost",
  "cancellation_reasons", "cancellation_note", "conversion_version_id", "recipe_version_id",
  "conversion_snapshot", "recipe_snapshot", "cost_snapshot", "calculation_snapshot", "created_at"
)
SELECT
  'legacy-retired-line-' || md5(line."company_id" || ':' || line."id"),
  line."tenant_id", line."company_id", line.target_document_id, line.target_item_id,
  line.target_line_number, item."name_ar", line."quantity", line.target_input_unit_id,
  line.target_quantity, line.target_unit_id,
  line."unit_price", line.target_input_unit_id, line."quantity", line.target_total, 0,
  line."cancellation_reasons", line."notes", NULL, NULL,
  jsonb_build_object(
    'sourceSystem', 'legacy-orders-retirement',
    'sourceLineId', line."id",
    'originalQuantity', line."quantity"::text,
    'originalMultiplier', line."quantity_multiplier"::text,
    'originalUnit', line."unit",
    'originalPackaging', line."packaging"
  ),
  CASE WHEN line."inventory_consumption_snapshot" IS NULL THEN NULL ELSE line."inventory_consumption_snapshot" END,
  jsonb_build_object('policy', 'historical-import-no-reposting', 'totalCost', '0'),
  jsonb_build_object('kernelVersion', 4, 'sourceLineId', line."id", 'historicalImport', true),
  line."created_at"
FROM prepared_lines line
JOIN "orders_v4_items" item ON item."id" = line.target_item_id
ON CONFLICT ("document_id", "line_number") DO NOTHING;

-- Upgrade the old skipped-cancellation maps and create maps for historical
-- employee department requests that were outside the original cutover scope.
UPDATE "orders_v4_migration_map" map
SET
  "target_entity" = 'OrdersV4Document',
  "target_id" = 'legacy-retired-document-' || md5(map."company_id" || ':' || map."source_id"),
  "detail" = COALESCE(map."detail", '{}'::jsonb) || jsonb_build_object('retirementBackfill', true),
  "migrated_at" = now()
FROM "staff_orders" source
WHERE map."company_id" = source."company_id"
  AND map."source_system" = 'legacy-orders'
  AND map."source_entity" = 'StaffOrder'
  AND map."source_id" = source."id"
  AND source."order_type" = 'sale'
  AND source."entry_type" = 'cancellation';

INSERT INTO "orders_v4_migration_map" (
  "id", "tenant_id", "company_id", "source_system", "source_entity", "source_id",
  "target_entity", "target_id", "source_checksum", "migration_run_id", "status", "detail", "migrated_at"
)
SELECT
  'legacy-retired-map-' || md5(source."company_id" || ':' || source."id"),
  source."tenant_id", source."company_id", 'legacy-orders', 'StaffOrder', source."id",
  'OrdersV4Document', 'legacy-retired-document-' || md5(source."company_id" || ':' || source."id"),
  md5(source."id" || ':' || source."updated_at"::text), 'legacy-orders-retirement', 'verified',
  jsonb_build_object('retirementBackfill', true), now()
FROM "staff_orders" source
WHERE source."order_type" = 'order'
ON CONFLICT ("company_id", "source_system", "source_entity", "source_id") DO UPDATE
SET "target_entity" = EXCLUDED."target_entity",
    "target_id" = EXCLUDED."target_id",
    "status" = 'verified',
    "detail" = EXCLUDED."detail",
    "migrated_at" = EXCLUDED."migrated_at";

DO $$
DECLARE
  failed_company text;
BEGIN
  -- Catalog and purchase-document coverage must be complete and company-safe.
  SELECT source."company_id" INTO failed_company
  FROM "order_products" source
  LEFT JOIN "orders_v4_migration_map" map
    ON map."company_id" = source."company_id" AND map."source_system" = 'legacy-orders'
   AND map."source_entity" = 'OrderProduct' AND map."source_id" = source."id" AND map."status" = 'verified'
  LEFT JOIN "orders_v4_items" target
    ON target."id" = map."target_id" AND target."company_id" = source."company_id"
  WHERE target."id" IS NULL LIMIT 1;
  IF failed_company IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy Orders retirement aborted: product parity failed for company %', failed_company;
  END IF;

  SELECT source."company_id" INTO failed_company
  FROM "orders" source
  LEFT JOIN "orders_v4_migration_map" map
    ON map."company_id" = source."company_id" AND map."source_system" = 'legacy-orders'
   AND map."source_entity" = 'Order' AND map."source_id" = source."id" AND map."status" = 'verified'
  LEFT JOIN "orders_v4_documents" target
    ON target."id" = map."target_id" AND target."company_id" = source."company_id"
  WHERE target."id" IS NULL
     OR target."document_type" <> 'purchase'
     OR target."total_amount" <> source."total_amount"::decimal(20,6)
     OR target."status" <> CASE WHEN source."status" = 'active' THEN 'received' ELSE 'reversed' END
     OR (SELECT count(*) FROM "order_items" line WHERE line."order_id" = source."id")
        <> (SELECT count(*) FROM "orders_v4_document_lines" line WHERE line."document_id" = target."id")
     OR EXISTS (
       SELECT 1
       FROM (
         SELECT item_map."target_id" AS item_id,
                sum(COALESCE(line."inventory_base_quantity_snapshot", line."quantity" * line."quantity_multiplier"))::decimal(24,8) AS base_quantity,
                sum(line."amount")::decimal(20,6) AS line_total
         FROM "order_items" line
         JOIN "orders_v4_migration_map" item_map
           ON item_map."company_id" = source."company_id" AND item_map."source_system" = 'legacy-orders'
          AND item_map."source_entity" = 'OrderProduct' AND item_map."source_id" = line."product_id"
          AND item_map."status" = 'verified'
         WHERE line."order_id" = source."id"
         GROUP BY item_map."target_id"
       ) source_lines
       FULL JOIN (
         SELECT line."item_id", sum(line."base_quantity")::decimal(24,8) AS base_quantity,
                sum(line."line_total")::decimal(20,6) AS line_total
         FROM "orders_v4_document_lines" line
         WHERE line."document_id" = target."id"
         GROUP BY line."item_id"
       ) target_lines USING (item_id)
       WHERE source_lines.item_id IS NULL OR target_lines.item_id IS NULL
          OR source_lines.base_quantity <> target_lines.base_quantity
          OR source_lines.line_total <> target_lines.line_total
     )
  LIMIT 1;
  IF failed_company IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy Orders retirement aborted: purchase parity failed for company %', failed_company;
  END IF;

  -- Every staff record, including department requests and cancellations, must
  -- now resolve to a real V4 document with the same line count.
  SELECT source."company_id" INTO failed_company
  FROM "staff_orders" source
  LEFT JOIN "orders_v4_migration_map" map
    ON map."company_id" = source."company_id" AND map."source_system" = 'legacy-orders'
   AND map."source_entity" = 'StaffOrder' AND map."source_id" = source."id" AND map."status" = 'verified'
  LEFT JOIN "orders_v4_documents" target
    ON target."id" = map."target_id" AND target."company_id" = source."company_id"
  WHERE target."id" IS NULL
     OR (source."order_type" = 'order' AND (target."document_type" <> 'purchase' OR target."status" <> 'prepared'))
     OR (source."order_type" = 'sale' AND source."entry_type" = 'issue'
         AND (target."document_type" <> 'registration' OR target."registration_entry_type" <> 'issue'))
     OR (source."order_type" = 'sale' AND source."entry_type" = 'cancellation'
         AND (target."document_type" <> 'registration' OR target."registration_entry_type" <> 'cancellation'))
     OR (SELECT count(*) FROM "staff_order_items" line WHERE line."staff_order_id" = source."id")
        <> (SELECT count(*) FROM "orders_v4_document_lines" line WHERE line."document_id" = target."id")
     OR target."total_amount" <> COALESCE((
          SELECT sum(line."quantity" * line."unit_price")::decimal(20,6)
          FROM "staff_order_items" line WHERE line."staff_order_id" = source."id"
        ), 0)::decimal(20,6)
     OR EXISTS (
       SELECT 1
       FROM (
         SELECT item_map."target_id" AS item_id,
                sum(line."quantity" * COALESCE(NULLIF(line."quantity_multiplier", 0), 1))::decimal(24,8) AS base_quantity,
                sum(line."quantity" * line."unit_price")::decimal(20,6) AS line_total
         FROM "staff_order_items" line
         JOIN "orders_v4_migration_map" item_map
           ON item_map."company_id" = source."company_id" AND item_map."source_system" = 'legacy-orders'
          AND item_map."source_entity" = 'OrderProduct' AND item_map."source_id" = line."product_id"
          AND item_map."status" = 'verified'
         WHERE line."staff_order_id" = source."id"
         GROUP BY item_map."target_id"
       ) source_lines
       FULL JOIN (
         SELECT line."item_id", sum(line."base_quantity")::decimal(24,8) AS base_quantity,
                sum(line."line_total")::decimal(20,6) AS line_total
         FROM "orders_v4_document_lines" line
         WHERE line."document_id" = target."id"
         GROUP BY line."item_id"
       ) target_lines USING (item_id)
       WHERE source_lines.item_id IS NULL OR target_lines.item_id IS NULL
          OR source_lines.base_quantity <> target_lines.base_quantity
          OR source_lines.line_total <> target_lines.line_total
     )
  LIMIT 1;
  IF failed_company IS NOT NULL THEN
    RAISE EXCEPTION 'Legacy Orders retirement aborted: staff parity failed for company %', failed_company;
  END IF;

  -- Category/section/unit rows are governance data and must also be covered.
  IF EXISTS (
    SELECT 1 FROM "order_categories" source
    WHERE NOT EXISTS (
      SELECT 1 FROM "orders_v4_migration_map" map
      JOIN "orders_v4_categories" target ON target."id" = map."target_id" AND target."company_id" = source."company_id"
      WHERE map."company_id" = source."company_id" AND map."source_system" = 'legacy-orders'
        AND map."source_entity" = 'OrderCategory' AND map."source_id" = source."id" AND map."status" = 'verified'
    )
    AND NOT EXISTS (
      SELECT 1 FROM "orders_v4_legacy_archives" archive
      WHERE archive."company_id" = source."company_id"
        AND archive."source_system" = 'legacy-orders-catalog'
        AND archive."source_table" = 'order_categories'
        AND archive."source_id" = source."id"
        AND archive."source_checksum" = md5(to_jsonb(source)::text)
    )
  ) OR EXISTS (
    SELECT 1 FROM "order_sections" source
    WHERE NOT EXISTS (
      SELECT 1 FROM "orders_v4_migration_map" map
      JOIN "orders_v4_sections" target ON target."id" = map."target_id" AND target."company_id" = source."company_id"
      WHERE map."company_id" = source."company_id" AND map."source_system" = 'legacy-orders'
        AND map."source_entity" = 'OrderSection' AND map."source_id" = source."id" AND map."status" = 'verified'
    )
    AND NOT EXISTS (
      SELECT 1 FROM "orders_v4_legacy_archives" archive
      WHERE archive."company_id" = source."company_id"
        AND archive."source_system" = 'legacy-orders-catalog'
        AND archive."source_table" = 'order_sections'
        AND archive."source_id" = source."id"
        AND archive."source_checksum" = md5(to_jsonb(source)::text)
    )
  ) OR EXISTS (
    SELECT 1 FROM "order_catalog_units" source
    WHERE NOT EXISTS (
      SELECT 1 FROM "orders_v4_migration_map" map
      JOIN "orders_v4_units" target ON target."id" = map."target_id" AND target."company_id" = source."company_id"
      WHERE map."company_id" = source."company_id" AND map."source_system" = 'legacy-orders'
        AND map."source_entity" = 'OrderCatalogUnit' AND map."source_id" = source."id" AND map."status" = 'verified'
    )
    AND NOT EXISTS (
      SELECT 1 FROM "orders_v4_legacy_archives" archive
      WHERE archive."company_id" = source."company_id"
        AND archive."source_system" = 'legacy-orders-catalog'
        AND archive."source_table" = 'order_catalog_units'
        AND archive."source_id" = source."id"
        AND archive."source_checksum" = md5(to_jsonb(source)::text)
    )
  ) THEN
    RAISE EXCEPTION 'Legacy Orders retirement aborted: catalog governance parity failed';
  END IF;
END $$;

-- Preserve access by translating legacy permission grants to their V4 peers.
UPDATE "roles" AS role
SET "permissions" = (
  SELECT COALESCE(array_agg(DISTINCT permission ORDER BY permission), ARRAY[]::text[])
  FROM (
    SELECT CASE source_permission
      WHEN 'VIEW_ORDERS' THEN 'VIEW_ORDERS_V4'
      WHEN 'VIEW_INTERNAL_REGISTRATION' THEN 'VIEW_ORDERS_V4'
      WHEN 'ORDERS_READ' THEN 'ORDERS_V4_READ'
      WHEN 'ORDERS_WRITE' THEN 'ORDERS_V4_WRITE'
      WHEN 'ORDERS_DELETE' THEN 'ORDERS_V4_DELETE'
      WHEN 'ORDERS_STAFF_SUBMIT' THEN 'ORDERS_V4_STAFF_SUBMIT'
      WHEN 'STAFF_ORDERS_READ' THEN 'ORDERS_V4_REPORTS_READ'
      WHEN 'STAFF_ORDERS_SUBMIT' THEN 'ORDERS_V4_INTERNAL_SUBMIT'
      ELSE source_permission
    END AS permission
    FROM unnest(role."permissions") AS source_permission
  ) translated
);

UPDATE "roles" AS role
SET "last_seed_permissions" = (
  SELECT COALESCE(array_agg(DISTINCT permission ORDER BY permission), ARRAY[]::text[])
  FROM (
    SELECT CASE source_permission
      WHEN 'VIEW_ORDERS' THEN 'VIEW_ORDERS_V4'
      WHEN 'VIEW_INTERNAL_REGISTRATION' THEN 'VIEW_ORDERS_V4'
      WHEN 'ORDERS_READ' THEN 'ORDERS_V4_READ'
      WHEN 'ORDERS_WRITE' THEN 'ORDERS_V4_WRITE'
      WHEN 'ORDERS_DELETE' THEN 'ORDERS_V4_DELETE'
      WHEN 'ORDERS_STAFF_SUBMIT' THEN 'ORDERS_V4_STAFF_SUBMIT'
      WHEN 'STAFF_ORDERS_READ' THEN 'ORDERS_V4_REPORTS_READ'
      WHEN 'STAFF_ORDERS_SUBMIT' THEN 'ORDERS_V4_INTERNAL_SUBMIT'
      ELSE source_permission
    END AS permission
    FROM unnest(role."last_seed_permissions") AS source_permission
  ) translated
);

-- Explicit FK order, deliberately without CASCADE. An unknown dependency makes
-- deployment fail instead of silently deleting data outside the retired domain.
DROP TABLE IF EXISTS "shisha_inventory_movements";
DROP TABLE IF EXISTS "shisha_stocktakes";
DROP TABLE IF EXISTS "shisha_inventory_settings";
DROP TABLE IF EXISTS "inventory_ledger_entries_v2";
DROP TABLE IF EXISTS "inventory_definition_versions_v2";
DROP TABLE IF EXISTS "inventory_locations_v2";
DROP TABLE IF EXISTS "inventory_movements";
DROP TABLE IF EXISTS "inventory_stocktake_lines";
DROP TABLE IF EXISTS "inventory_stocktakes";
DROP TABLE IF EXISTS "staff_order_items";
DROP TABLE IF EXISTS "staff_orders";
DROP TABLE IF EXISTS "order_items";
DROP TABLE IF EXISTS "orders";
DROP TABLE IF EXISTS "order_products";
DROP TABLE IF EXISTS "order_conversion_templates";
DROP TABLE IF EXISTS "order_catalog_units";
DROP TABLE IF EXISTS "order_sections";
DROP TABLE IF EXISTS "order_categories";

DROP FUNCTION IF EXISTS validate_inventory_v2_scope();
DROP FUNCTION IF EXISTS reject_inventory_audit_mutation();
DROP FUNCTION IF EXISTS reject_shisha_inventory_history_mutation();

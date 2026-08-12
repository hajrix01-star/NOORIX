-- Some early internal registrations were accepted with a zero selling-price
-- snapshot. Correct only those zero-price lines when the exact same item unit
-- now has an explicit positive configured selling price.
--
-- Existing non-zero snapshots are deliberately preserved. This corrects the
-- operational internal-sales report only; quantities, stock, custody,
-- operational cost, invoices, and the financial ledger are not changed.

WITH eligible AS (
  SELECT
    line."id",
    line."tenant_id",
    line."company_id",
    line."document_id",
    line."unit_price" AS "old_unit_price",
    line."line_total" AS "old_line_total",
    unit."sale_price" AS "new_unit_price",
    (line."price_quantity" * unit."sale_price")::DECIMAL(20, 6) AS "new_line_total"
  FROM "orders_v4_document_lines" AS line
  INNER JOIN "orders_v4_documents" AS document
    ON document."id" = line."document_id"
    AND document."company_id" = line."company_id"
  INNER JOIN "orders_v4_items" AS item
    ON item."id" = line."item_id"
    AND item."company_id" = line."company_id"
  INNER JOIN "orders_v4_item_units" AS unit
    ON unit."item_id" = line."item_id"
    AND unit."unit_id" = line."price_unit_id"
    AND unit."company_id" = line."company_id"
  WHERE document."document_type" = 'registration'
    AND COALESCE(document."registration_entry_type", 'issue') = 'issue'
    AND document."status" = 'received'
    AND item."item_type" = 'sale'
    AND line."unit_price" = 0
    AND line."line_total" = 0
    AND unit."is_active" = TRUE
    AND unit."sale_price" > 0
), audit AS (
  INSERT INTO "audit_logs" (
    "id", "tenant_id", "company_id", "user_id", "action", "entity", "entity_id", "old_value", "new_value"
  )
  SELECT
    CONCAT('ov4-registration-sale-price-', eligible."id"),
    eligible."tenant_id",
    eligible."company_id",
    NULL,
    'update',
    'orders_v4_registration_historical_sale_price',
    eligible."id",
    jsonb_build_object(
      'unitPrice', eligible."old_unit_price"::TEXT,
      'lineTotal', eligible."old_line_total"::TEXT,
      'documentId', eligible."document_id"
    ),
    jsonb_build_object(
      'unitPrice', eligible."new_unit_price"::TEXT,
      'lineTotal', eligible."new_line_total"::TEXT,
      'source', 'configured_sale_price_backfill'
    )
  FROM eligible
  ON CONFLICT ("id") DO NOTHING
  RETURNING "entity_id"
), corrected_lines AS (
  UPDATE "orders_v4_document_lines" AS line
  SET
    "unit_price" = eligible."new_unit_price",
    "line_total" = eligible."new_line_total",
    "calculation_snapshot" = jsonb_set(
      jsonb_set(line."calculation_snapshot", '{unitPrice}', to_jsonb(eligible."new_unit_price"::TEXT), TRUE),
      '{lineTotal}', to_jsonb(eligible."new_line_total"::TEXT), TRUE
    )
  FROM eligible
  INNER JOIN audit ON audit."entity_id" = eligible."id"
  WHERE line."id" = eligible."id"
  RETURNING line."document_id"
), affected_documents AS (
  SELECT DISTINCT "document_id" FROM corrected_lines
), recalculated_documents AS (
  SELECT
    document."id",
    SUM(line."line_total")::DECIMAL(20, 6) AS "total_amount"
  FROM "orders_v4_documents" AS document
  INNER JOIN affected_documents ON affected_documents."document_id" = document."id"
  INNER JOIN "orders_v4_document_lines" AS line ON line."document_id" = document."id"
  GROUP BY document."id"
)
UPDATE "orders_v4_documents" AS document
SET
  "subtotal" = recalculated_documents."total_amount",
  "total_amount" = recalculated_documents."total_amount",
  "revision" = document."revision" + 1,
  "updated_at" = NOW(),
  "calculation_snapshot" = jsonb_set(
    jsonb_set(document."calculation_snapshot", '{subtotal}', to_jsonb(recalculated_documents."total_amount"::TEXT), TRUE),
    '{totalAmount}', to_jsonb(recalculated_documents."total_amount"::TEXT), TRUE
  )
FROM recalculated_documents
WHERE document."id" = recalculated_documents."id";

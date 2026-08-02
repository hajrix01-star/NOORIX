ALTER TABLE "orders_v4_documents"
  ADD COLUMN "operational_cost" DECIMAL(20,6) NOT NULL DEFAULT 0;

ALTER TABLE "orders_v4_document_lines"
  ADD COLUMN "operational_cost" DECIMAL(20,6) NOT NULL DEFAULT 0;

-- Backfill purchases from their financial totals and registrations from the
-- immutable recipe-cost snapshot already stored by the V4 kernel.
UPDATE "orders_v4_document_lines" AS line
SET "operational_cost" = CASE
  WHEN document."document_type" = 'registration'
    THEN COALESCE(
      NULLIF(line."cost_snapshot" ->> 'totalCost', '')::DECIMAL(20,6),
      (
        SELECT ABS(SUM(ledger."value_delta"))
        FROM "orders_v4_inventory_ledger" AS ledger
        WHERE ledger."document_line_id" = line."id"
          AND ledger."entry_type" = 'issue'
      ),
      0
    )
  ELSE line."line_total"
END
FROM "orders_v4_documents" AS document
WHERE document."id" = line."document_id";

UPDATE "orders_v4_documents" AS document
SET "operational_cost" = CASE
  WHEN document."document_type" = 'registration'
    THEN COALESCE((
      SELECT SUM(line."operational_cost")
      FROM "orders_v4_document_lines" AS line
      WHERE line."document_id" = document."id"
    ), 0)
  ELSE document."total_amount"
END;

ALTER TABLE "orders_v4_documents"
  ADD CONSTRAINT "orders_v4_document_operational_cost_check"
  CHECK ("status" = 'reversed' OR "operational_cost" >= 0);

ALTER TABLE "orders_v4_document_lines"
  ADD CONSTRAINT "orders_v4_document_line_operational_cost_check"
  CHECK ("operational_cost" >= 0);

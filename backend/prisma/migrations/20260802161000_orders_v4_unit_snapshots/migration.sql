-- Preserve the exact inventory/base unit used by every historical V4 calculation.
-- This makes inventory-unit changes auditable instead of relabelling old quantities.

ALTER TABLE "orders_v4_document_lines" ADD COLUMN "base_unit_id" TEXT;
ALTER TABLE "orders_v4_price_history" ADD COLUMN "inventory_unit_id" TEXT;
ALTER TABLE "orders_v4_inventory_ledger" ADD COLUMN "inventory_unit_id" TEXT;

ALTER TABLE "orders_v4_inventory_ledger" DROP CONSTRAINT "orders_v4_inventory_entry_type_check";
ALTER TABLE "orders_v4_inventory_ledger" ADD CONSTRAINT "orders_v4_inventory_entry_type_check"
  CHECK ("entry_type" IN ('receipt', 'issue', 'transfer_in', 'transfer_out', 'stocktake_adjustment', 'reversal', 'unit_rebase'));

DROP TRIGGER IF EXISTS orders_v4_inventory_ledger_immutable ON "orders_v4_inventory_ledger";
DROP TRIGGER IF EXISTS orders_v4_price_history_immutable ON "orders_v4_price_history";

UPDATE "orders_v4_document_lines" AS line
SET "base_unit_id" = item."inventory_unit_id"
FROM "orders_v4_items" AS item
WHERE item."id" = line."item_id";

UPDATE "orders_v4_price_history" AS price
SET "inventory_unit_id" = item."inventory_unit_id"
FROM "orders_v4_items" AS item
WHERE item."id" = price."item_id";

UPDATE "orders_v4_inventory_ledger" AS ledger
SET "inventory_unit_id" = item."inventory_unit_id"
FROM "orders_v4_items" AS item
WHERE item."id" = ledger."item_id";

ALTER TABLE "orders_v4_document_lines" ALTER COLUMN "base_unit_id" SET NOT NULL;
ALTER TABLE "orders_v4_price_history" ALTER COLUMN "inventory_unit_id" SET NOT NULL;
ALTER TABLE "orders_v4_inventory_ledger" ALTER COLUMN "inventory_unit_id" SET NOT NULL;

CREATE INDEX "orders_v4_document_lines_base_unit_id_idx" ON "orders_v4_document_lines"("base_unit_id");
CREATE INDEX "orders_v4_price_history_inventory_unit_id_idx" ON "orders_v4_price_history"("inventory_unit_id");
CREATE INDEX "orders_v4_inventory_ledger_inventory_unit_id_idx" ON "orders_v4_inventory_ledger"("inventory_unit_id");

ALTER TABLE "orders_v4_document_lines"
  ADD CONSTRAINT "orders_v4_document_lines_base_unit_id_fkey"
  FOREIGN KEY ("base_unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orders_v4_price_history"
  ADD CONSTRAINT "orders_v4_price_history_inventory_unit_id_fkey"
  FOREIGN KEY ("inventory_unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "orders_v4_inventory_ledger"
  ADD CONSTRAINT "orders_v4_inventory_ledger_inventory_unit_id_fkey"
  FOREIGN KEY ("inventory_unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER orders_v4_inventory_ledger_immutable BEFORE UPDATE OR DELETE ON "orders_v4_inventory_ledger"
  FOR EACH ROW EXECUTE FUNCTION orders_v4_reject_mutation();
CREATE TRIGGER orders_v4_price_history_immutable BEFORE UPDATE OR DELETE ON "orders_v4_price_history"
  FOR EACH ROW EXECUTE FUNCTION orders_v4_reject_mutation();

-- Independent operational cancellation records for internal registration.
-- They deliberately do not reference a previous registration document.
ALTER TABLE "orders_v4_documents"
  ADD COLUMN "registration_entry_type" TEXT;

ALTER TABLE "orders_v4_document_lines"
  ADD COLUMN "cancellation_reasons" JSONB,
  ADD COLUMN "cancellation_note" TEXT;

UPDATE "orders_v4_documents"
SET "registration_entry_type" = 'issue'
WHERE "document_type" = 'registration';

ALTER TABLE "orders_v4_documents"
  ADD CONSTRAINT "orders_v4_documents_registration_entry_check"
  CHECK (
    ("document_type" = 'purchase' AND "registration_entry_type" IS NULL)
    OR
    ("document_type" = 'registration' AND "registration_entry_type" = 'issue')
    OR
    ("document_type" = 'registration' AND "registration_entry_type" = 'cancellation')
  );

ALTER TABLE "orders_v4_document_lines"
  ADD CONSTRAINT "orders_v4_document_lines_cancellation_reasons_check"
  CHECK (
    "cancellation_reasons" IS NULL
    OR (jsonb_typeof("cancellation_reasons") = 'array' AND jsonb_array_length("cancellation_reasons") > 0)
  );

ALTER TABLE "orders_v4_document_lines"
  ADD CONSTRAINT "orders_v4_document_lines_other_cancellation_note_check"
  CHECK (
    NOT (COALESCE("cancellation_reasons", '[]'::jsonb) ? 'other')
    OR LENGTH(BTRIM(COALESCE("cancellation_note", ''))) > 0
  );

CREATE INDEX "orders_v4_documents_company_type_entry_date_idx"
  ON "orders_v4_documents"("company_id", "document_type", "registration_entry_type", "document_date");

CREATE OR REPLACE FUNCTION orders_v4_validate_cancellation_line()
RETURNS TRIGGER AS $$
DECLARE
  entry_kind TEXT;
  invalid_reason TEXT;
BEGIN
  SELECT "registration_entry_type" INTO entry_kind
  FROM "orders_v4_documents"
  WHERE "id" = NEW."document_id";

  IF entry_kind = 'cancellation' THEN
    IF NEW."cancellation_reasons" IS NULL OR jsonb_array_length(NEW."cancellation_reasons") = 0 THEN
      RAISE EXCEPTION 'Orders V4 cancellation line requires at least one reason';
    END IF;
    SELECT reason INTO invalid_reason
    FROM jsonb_array_elements_text(NEW."cancellation_reasons") AS reason
    WHERE reason NOT IN (
      'customer_disliked', 'replaced_item', 'order_error', 'registration_error',
      'delayed_order', 'duplicate_order', 'customer_changed_mind', 'item_unavailable', 'other'
    )
    LIMIT 1;
    IF invalid_reason IS NOT NULL THEN
      RAISE EXCEPTION 'Orders V4 cancellation reason is invalid: %', invalid_reason;
    END IF;
  ELSIF NEW."cancellation_reasons" IS NOT NULL OR NEW."cancellation_note" IS NOT NULL THEN
    RAISE EXCEPTION 'Orders V4 cancellation metadata is allowed only on cancellation lines';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_v4_document_line_cancellation_guard
BEFORE INSERT OR UPDATE ON "orders_v4_document_lines"
FOR EACH ROW EXECUTE FUNCTION orders_v4_validate_cancellation_line();

ALTER TABLE "orders_v4_inventory_ledger"
  DROP CONSTRAINT "orders_v4_inventory_entry_type_check";

ALTER TABLE "orders_v4_inventory_ledger"
  ADD CONSTRAINT "orders_v4_inventory_entry_type_check"
  CHECK ("entry_type" IN (
    'receipt', 'issue', 'transfer_in', 'transfer_out',
    'stocktake_adjustment', 'negative_stock_revaluation', 'reversal', 'unit_rebase',
    'cutover_opening', 'registration_cancellation'
  ));

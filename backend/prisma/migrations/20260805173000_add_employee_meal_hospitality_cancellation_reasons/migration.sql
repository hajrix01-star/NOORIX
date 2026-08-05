-- Extend the centrally controlled Orders V4 cancellation reasons.
-- The trigger remains the database-level guard for every write path.
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
      'delayed_order', 'duplicate_order', 'customer_changed_mind', 'item_unavailable',
      'employee_meal', 'hospitality', 'other'
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

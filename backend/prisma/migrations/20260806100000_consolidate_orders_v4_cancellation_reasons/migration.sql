-- Consolidate the operational cancellation list from eleven overlapping reasons to six.
-- Keep both vocabularies valid while historical rows are translated, then enforce only the new list.
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
      'customer_disliked', 'customer_changed_mind', 'customer_cancellation',
      'order_error', 'registration_error', 'delayed_order', 'duplicate_order',
      'item_unavailable', 'operational_reason', 'replaced_item',
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

UPDATE "orders_v4_document_lines" AS line
SET "cancellation_reasons" = (
  SELECT jsonb_agg(mapped_reason ORDER BY first_ordinal)
  FROM (
    SELECT
      CASE source.reason
        WHEN 'customer_disliked' THEN 'customer_cancellation'
        WHEN 'customer_changed_mind' THEN 'customer_cancellation'
        WHEN 'order_error' THEN 'operational_reason'
        WHEN 'registration_error' THEN 'operational_reason'
        WHEN 'delayed_order' THEN 'operational_reason'
        WHEN 'duplicate_order' THEN 'operational_reason'
        WHEN 'item_unavailable' THEN 'operational_reason'
        ELSE source.reason
      END AS mapped_reason,
      MIN(source.ordinality) AS first_ordinal
    FROM jsonb_array_elements_text(line."cancellation_reasons")
      WITH ORDINALITY AS source(reason, ordinality)
    GROUP BY
      CASE source.reason
        WHEN 'customer_disliked' THEN 'customer_cancellation'
        WHEN 'customer_changed_mind' THEN 'customer_cancellation'
        WHEN 'order_error' THEN 'operational_reason'
        WHEN 'registration_error' THEN 'operational_reason'
        WHEN 'delayed_order' THEN 'operational_reason'
        WHEN 'duplicate_order' THEN 'operational_reason'
        WHEN 'item_unavailable' THEN 'operational_reason'
        ELSE source.reason
      END
  ) AS consolidated
)
WHERE line."cancellation_reasons" ?| ARRAY[
  'customer_disliked', 'customer_changed_mind', 'order_error', 'registration_error',
  'delayed_order', 'duplicate_order', 'item_unavailable'
];

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
      'customer_cancellation', 'operational_reason', 'replaced_item',
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

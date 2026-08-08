-- Correct the remaining known recurring lines found in the cross-company audit.
-- This is classification-only: invoice amounts, tax, suppliers, vault
-- allocations, and ledger postings must remain unchanged.
WITH target_lines AS (
  SELECT
    el."id",
    el."tenant_id",
    el."company_id",
    el."kind" AS previous_kind
  FROM "expense_lines" el
  LEFT JOIN "categories" c ON c."id" = el."category_id"
  WHERE lower(btrim(el."name_ar")) IN (
      'ضريبة القيمة المضافة 15',
      'vat 15',
      'vat 15%',
      'رسوم ماء ستي ووك',
      'رخصة البلدية',
      'فتح 24'
    )
    OR lower(btrim(COALESCE(el."name_en", ''))) IN ('vat 15', 'vat 15%')
    -- Electricity is a recurring service. Restricting it to the electricity
    -- category deliberately excludes ordinary electrical repair expenses.
    OR (
      lower(btrim(COALESCE(c."name_ar", ''))) = 'كهرباء'
      AND lower(btrim(el."name_ar")) LIKE 'كهرب%'
    )
), impacted AS (
  SELECT
    t."id",
    t."tenant_id",
    t."company_id",
    t.previous_kind,
    COUNT(i."id") FILTER (WHERE i."kind" = 'expense' AND i."status" = 'active')::int AS reclassified_invoice_count
  FROM target_lines t
  LEFT JOIN "invoices" i
    ON i."expense_line_id" = t."id"
   AND i."company_id" = t."company_id"
  GROUP BY t."id", t."tenant_id", t."company_id", t.previous_kind
), updated_lines AS (
  UPDATE "expense_lines" el
  SET "kind" = 'fixed_expense', "updated_at" = CURRENT_TIMESTAMP
  FROM impacted p
  WHERE el."id" = p."id"
    AND el."kind" <> 'fixed_expense'
  RETURNING el."id"
), updated_invoices AS (
  UPDATE "invoices" i
  SET "kind" = 'fixed_expense', "updated_at" = CURRENT_TIMESTAMP
  FROM impacted p
  WHERE i."expense_line_id" = p."id"
    AND i."company_id" = p."company_id"
    AND i."kind" = 'expense'
    AND i."status" = 'active'
  RETURNING i."id"
)
INSERT INTO "audit_logs" (
  "id", "tenant_id", "company_id", "action", "entity", "entity_id", "old_value", "new_value", "created_at"
)
SELECT
  'recurring-expense-correction-' || p."id",
  p."tenant_id",
  p."company_id",
  'migrate',
  'expense_line_invoice_kind_sync',
  p."id",
  jsonb_build_object('kind', p.previous_kind),
  jsonb_build_object(
    'kind', 'fixed_expense',
    'syncedInvoiceCount', p.reclassified_invoice_count,
    'scope', 'recurring_cross_company_correction_20260809'
  ),
  CURRENT_TIMESTAMP
FROM impacted p
WHERE p.previous_kind <> 'fixed_expense' OR p.reclassified_invoice_count > 0
ON CONFLICT ("id") DO NOTHING;

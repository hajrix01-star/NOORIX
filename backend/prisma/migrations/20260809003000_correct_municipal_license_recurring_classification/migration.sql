-- The 30,020 SAR municipal invoice is specifically the annual tobacco-service
-- license.  Do not promote all generic municipal-license lines: an old generic
-- line can represent another municipal service.  Instead, preserve the old
-- line and move this known invoice to a dedicated recurring expense line.
--
-- Classification and relation correction only: invoice amounts, tax, supplier,
-- vault allocations, and ledger postings deliberately remain unchanged.
WITH target_invoices AS (
  SELECT
    i."id" AS invoice_id,
    i."tenant_id",
    i."company_id",
    i."expense_line_id" AS previous_expense_line_id,
    el."category_id",
    el."supplier_id"
  FROM "invoices" i
  INNER JOIN "expense_lines" el
    ON el."id" = i."expense_line_id"
   AND el."company_id" = i."company_id"
  WHERE i."status" = 'active'
    AND i."kind" = 'expense'
    AND i."total_amount" = 30020.0000
    AND (
      lower(btrim(el."name_ar")) IN ('رخصة بلدية', 'رخصة البلدية')
      OR lower(btrim(COALESCE(el."name_en", ''))) = 'municipal license'
    )
), created_lines AS (
  INSERT INTO "expense_lines" (
    "id", "tenant_id", "company_id", "name_ar", "name_en", "kind",
    "category_id", "supplier_id", "reference_amount",
    "allow_payment_amount_override", "annual_total_amount",
    "installment_interval_months", "notes", "is_active", "created_at", "updated_at"
  )
  SELECT
    'tobacco-service-license-' || t.invoice_id,
    t."tenant_id",
    t."company_id",
    'رخصة تقديم التبغ',
    'Tobacco Service License',
    'fixed_expense',
    t."category_id",
    t."supplier_id",
    30020.00,
    TRUE,
    30020.00,
    12,
    'ترحيل من بند رخصة بلدية: رخصة تقديم التبغ السنوية.',
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  FROM target_invoices t
  ON CONFLICT ("id") DO NOTHING
  RETURNING "id"
), reclassified_invoices AS (
  UPDATE "invoices" i
  SET
    "expense_line_id" = 'tobacco-service-license-' || i."id",
    "kind" = 'fixed_expense',
    "updated_at" = CURRENT_TIMESTAMP
  FROM target_invoices t
  WHERE i."id" = t.invoice_id
    AND i."company_id" = t."company_id"
  RETURNING i."id", i."tenant_id", i."company_id"
)
INSERT INTO "audit_logs" (
  "id", "tenant_id", "company_id", "action", "entity", "entity_id", "old_value", "new_value", "created_at"
)
SELECT
  'tobacco-service-license-reclassification-' || r."id",
  r."tenant_id",
  r."company_id",
  'migrate',
  'invoice_expense_line_reclassification',
  r."id",
  jsonb_build_object(
    'expenseLineId', t.previous_expense_line_id,
    'kind', 'expense'
  ),
  jsonb_build_object(
    'expenseLineId', 'tobacco-service-license-' || r."id",
    'expenseLineNameAr', 'رخصة تقديم التبغ',
    'kind', 'fixed_expense',
    'intervalMonths', 12
  ),
  CURRENT_TIMESTAMP
FROM reclassified_invoices r
INNER JOIN target_invoices t ON t.invoice_id = r."id"
ON CONFLICT ("id") DO NOTHING;

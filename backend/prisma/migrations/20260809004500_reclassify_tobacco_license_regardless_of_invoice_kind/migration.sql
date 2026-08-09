-- The earlier tobacco-license correction intentionally targeted ordinary
-- expense invoices.  Some historical invoices were already promoted to
-- fixed_expense while their source line remained generic, inactive, or absent,
-- which left them without the dedicated tobacco-license line.  Capture both
-- safe expense kinds with the known amount plus municipal source-line/supplier
-- guards.
--
-- No monetary, supplier, tax, vault-allocation, or ledger data is changed.
WITH target_invoices AS (
  SELECT
    i."id" AS invoice_id,
    i."tenant_id",
    i."company_id",
    i."expense_line_id" AS previous_expense_line_id,
    i."kind" AS previous_kind,
    COALESCE(el."category_id", i."category_id") AS category_id,
    COALESCE(el."supplier_id", i."supplier_id") AS supplier_id
  FROM "invoices" i
  LEFT JOIN "expense_lines" el
    ON el."id" = i."expense_line_id"
   AND el."company_id" = i."company_id"
  LEFT JOIN "suppliers" s
    ON s."id" = i."supplier_id"
   AND s."company_id" = i."company_id"
  WHERE i."status" = 'active'
    AND i."kind" IN ('expense', 'fixed_expense')
    AND (i."total_amount" = 30020.0000 OR i."net_amount" = 30020.0000)
    AND COALESCE(el."category_id", i."category_id") IS NOT NULL
    AND i."supplier_id" IS NOT NULL
    AND (
      lower(btrim(el."name_ar")) IN ('رخصة بلدية', 'رخصة البلدية')
      OR lower(btrim(COALESCE(el."name_en", ''))) = 'municipal license'
      OR lower(COALESCE(s."name_ar", '')) LIKE '%بلدي%'
      OR lower(COALESCE(s."name_en", '')) LIKE '%municipal%'
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
  'tobacco-service-license-kind-retry-' || r."id",
  r."tenant_id",
  r."company_id",
  'migrate',
  'invoice_expense_line_reclassification',
  r."id",
  jsonb_build_object(
    'expenseLineId', t.previous_expense_line_id,
    'kind', t.previous_kind
  ),
  jsonb_build_object(
    'expenseLineId', 'tobacco-service-license-' || r."id",
    'expenseLineNameAr', 'رخصة تقديم التبغ',
    'kind', 'fixed_expense',
    'intervalMonths', 12,
    'scope', 'retry_already_promoted_invoice_20260809'
  ),
  CURRENT_TIMESTAMP
FROM reclassified_invoices r
INNER JOIN target_invoices t ON t.invoice_id = r."id"
ON CONFLICT ("id") DO NOTHING;

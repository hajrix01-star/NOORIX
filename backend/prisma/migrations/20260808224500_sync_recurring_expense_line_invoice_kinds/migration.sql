-- One-time classification alignment for the agreed recurring government and
-- electricity expense lines. It changes classification only: amounts, dates,
-- suppliers, vault allocations, and ledger postings remain immutable.
--
-- Exact names only are intentional. In particular, an ordinary "electrical
-- repair" expense must never be promoted merely because it contains the word
-- electricity.
WITH target_lines AS (
  SELECT
    el."id",
    el."tenant_id",
    el."company_id",
    el."kind" AS previous_kind
  FROM "expense_lines" el
  WHERE lower(btrim(el."name_ar")) IN (
      'كهرباء',
      'فاتورة كهرباء',
      'رسوم كهرباء',
      'gosi',
      'التأمينات الاجتماعية',
      'تأمينات اجتماعية',
      'ضريبة القيمة المضافة',
      'ضريبة قيمة مضافة',
      'vat',
      'زكاة',
      'زكاة وضريبة'
    )
    OR lower(btrim(COALESCE(el."name_en", ''))) IN (
      'electricity',
      'electricity bill',
      'gosi',
      'social insurance',
      'vat',
      'value added tax',
      'zakat',
      'zakat and tax'
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
  'recurring-expense-kind-' || p."id",
  p."tenant_id",
  p."company_id",
  'migrate',
  'expense_line_invoice_kind_sync',
  p."id",
  jsonb_build_object('kind', p.previous_kind),
  jsonb_build_object('kind', 'fixed_expense', 'syncedInvoiceCount', p.reclassified_invoice_count, 'scope', 'gosi_vat_zakat_electricity'),
  CURRENT_TIMESTAMP
FROM impacted p
WHERE p.previous_kind <> 'fixed_expense' OR p.reclassified_invoice_count > 0
ON CONFLICT ("id") DO NOTHING;

-- مفتاح تطبيع داخلي + فهرس فريد جزئي للفواتير النشطة (شركة + مورد + رقم فاتورة المورد بعد التطبيع)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "supplier_invoice_dedup_key" TEXT;

UPDATE "invoices"
SET "supplier_invoice_dedup_key" = lower(
  translate(
    translate(
      regexp_replace(btrim(regexp_replace(COALESCE("supplier_invoice_number", ''), '[[:space:]]', '', 'g')),
        '٠١٢٣٤٥٦٧٨٩',
        '0123456789'
      ),
      '۰۱۲۳۴۵۶۷۸۹',
      '0123456789'
    )
  )
WHERE "supplier_id" IS NOT NULL
  AND "supplier_invoice_number" IS NOT NULL
  AND btrim("supplier_invoice_number") <> ''
  AND "kind" IN ('purchase', 'expense', 'fixed_expense', 'hr_expense')
  AND "status" = 'active';

UPDATE "invoices" SET "supplier_invoice_dedup_key" = NULL WHERE "supplier_invoice_dedup_key" = '';

CREATE UNIQUE INDEX "invoices_company_supplier_dedup_key_active_uq"
ON "invoices" ("company_id", "supplier_id", "supplier_invoice_dedup_key")
WHERE "status" = 'active'
  AND "supplier_id" IS NOT NULL
  AND "supplier_invoice_dedup_key" IS NOT NULL;

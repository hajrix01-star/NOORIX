-- Fix OCR tables schema to match Prisma schema exactly
-- Drop all ocr_* tables and recreate with correct columns
-- Safe: these are experimental tables with no production data yet

-- Drop all tables (CASCADE handles foreign key order)
DROP TABLE IF EXISTS "ocr_extraction_logs"   CASCADE;
DROP TABLE IF EXISTS "ocr_correction_rules"  CASCADE;
DROP TABLE IF EXISTS "ocr_price_history"     CASCADE;
DROP TABLE IF EXISTS "ocr_invoice_lines"     CASCADE;
DROP TABLE IF EXISTS "ocr_invoices"          CASCADE;
DROP TABLE IF EXISTS "ocr_item_aliases"      CASCADE;
DROP TABLE IF EXISTS "ocr_items"             CASCADE;
DROP TABLE IF EXISTS "ocr_supplier_aliases"  CASCADE;
DROP TABLE IF EXISTS "ocr_suppliers"         CASCADE;

-- ── ocr_suppliers ──────────────────────────────────────────────────────────
CREATE TABLE "ocr_suppliers" (
    "id"         TEXT        NOT NULL,
    "tenant_id"  TEXT        NOT NULL,
    "name_ar"    TEXT        NOT NULL,
    "name_en"    TEXT,
    "tax_number" TEXT,
    "phone"      TEXT,
    "notes"      TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_suppliers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ocr_suppliers_tenant_id_idx" ON "ocr_suppliers"("tenant_id");

-- ── ocr_supplier_aliases ────────────────────────────────────────────────────
CREATE TABLE "ocr_supplier_aliases" (
    "id"          TEXT        NOT NULL,
    "supplier_id" TEXT        NOT NULL,
    "alias"       TEXT        NOT NULL,
    "language"    TEXT        NOT NULL DEFAULT 'ar',
    "added_by"    TEXT        NOT NULL DEFAULT 'support',
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_supplier_aliases_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ocr_supplier_aliases_supplier_id_idx" ON "ocr_supplier_aliases"("supplier_id");

-- ── ocr_items ───────────────────────────────────────────────────────────────
CREATE TABLE "ocr_items" (
    "id"         TEXT        NOT NULL,
    "tenant_id"  TEXT        NOT NULL,
    "name_ar"    TEXT        NOT NULL,
    "name_en"    TEXT,
    "category"   TEXT,
    "unit_type"  TEXT,
    "notes"      TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ocr_items_tenant_id_idx" ON "ocr_items"("tenant_id");

-- ── ocr_item_aliases ────────────────────────────────────────────────────────
CREATE TABLE "ocr_item_aliases" (
    "id"         TEXT        NOT NULL,
    "item_id"    TEXT        NOT NULL,
    "alias"      TEXT        NOT NULL,
    "language"   TEXT        NOT NULL DEFAULT 'ar',
    "added_by"   TEXT        NOT NULL DEFAULT 'support',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_item_aliases_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ocr_item_aliases_item_id_idx" ON "ocr_item_aliases"("item_id");

-- ── ocr_invoices ────────────────────────────────────────────────────────────
CREATE TABLE "ocr_invoices" (
    "id"             TEXT         NOT NULL,
    "tenant_id"      TEXT         NOT NULL,
    "supplier_id"    TEXT,
    "invoice_number" TEXT,
    "invoice_date"   TIMESTAMP(3),
    "total_amount"   DECIMAL(14,2),
    "vat_amount"     DECIMAL(14,2),
    "image_url"      TEXT,
    "raw_extraction" JSONB,
    "status"         TEXT         NOT NULL DEFAULT 'pending',
    "notes"          TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_invoices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ocr_invoices_tenant_id_idx"   ON "ocr_invoices"("tenant_id");
CREATE INDEX "ocr_invoices_supplier_id_idx" ON "ocr_invoices"("supplier_id");

-- ── ocr_invoice_lines ───────────────────────────────────────────────────────
CREATE TABLE "ocr_invoice_lines" (
    "id"           TEXT         NOT NULL,
    "invoice_id"   TEXT         NOT NULL,
    "item_id"      TEXT,
    "raw_name"     TEXT         NOT NULL,
    "quantity"     DECIMAL(10,3),
    "unit_price"   DECIMAL(14,2),
    "total_price"  DECIMAL(14,2),
    "confidence"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "match_status" TEXT         NOT NULL DEFAULT 'pending',
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_invoice_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ocr_invoice_lines_invoice_id_idx" ON "ocr_invoice_lines"("invoice_id");
CREATE INDEX "ocr_invoice_lines_item_id_idx"    ON "ocr_invoice_lines"("item_id");

-- ── ocr_price_history ───────────────────────────────────────────────────────
CREATE TABLE "ocr_price_history" (
    "id"           TEXT         NOT NULL,
    "tenant_id"    TEXT         NOT NULL,
    "item_id"      TEXT         NOT NULL,
    "supplier_id"  TEXT         NOT NULL,
    "price"        DECIMAL(14,2) NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "invoice_id"   TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_price_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ocr_price_history_tenant_id_idx"   ON "ocr_price_history"("tenant_id");
CREATE INDEX "ocr_price_history_item_id_idx"      ON "ocr_price_history"("item_id");
CREATE INDEX "ocr_price_history_supplier_id_idx"  ON "ocr_price_history"("supplier_id");

-- ── ocr_correction_rules ────────────────────────────────────────────────────
CREATE TABLE "ocr_correction_rules" (
    "id"           TEXT         NOT NULL,
    "tenant_id"    TEXT         NOT NULL,
    "entity_type"  TEXT         NOT NULL,
    "supplier_id"  TEXT,
    "wrong_text"   TEXT         NOT NULL,
    "correct_text" TEXT         NOT NULL,
    "occurrences"  INTEGER      NOT NULL DEFAULT 1,
    "status"       TEXT         NOT NULL DEFAULT 'pending',
    "expires_at"   TIMESTAMP(3) NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_correction_rules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ocr_correction_rules_tenant_id_idx"  ON "ocr_correction_rules"("tenant_id");
CREATE INDEX "ocr_correction_rules_supplier_id_idx" ON "ocr_correction_rules"("supplier_id");

-- ── ocr_extraction_logs ─────────────────────────────────────────────────────
CREATE TABLE "ocr_extraction_logs" (
    "id"             TEXT         NOT NULL,
    "tenant_id"      TEXT         NOT NULL,
    "entity_type"    TEXT         NOT NULL,
    "supplier_id"    TEXT,
    "extracted_text" TEXT         NOT NULL,
    "normalized_text" TEXT,
    "resolved_to_id" TEXT,
    "resolved_text"  TEXT,
    "confidence"     DOUBLE PRECISION NOT NULL DEFAULT 0,
    "occurrences"    INTEGER      NOT NULL DEFAULT 1,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_extraction_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ocr_extraction_logs_tenant_id_idx"   ON "ocr_extraction_logs"("tenant_id");
CREATE INDEX "ocr_extraction_logs_supplier_id_idx" ON "ocr_extraction_logs"("supplier_id");

-- ── Foreign Keys ─────────────────────────────────────────────────────────────
ALTER TABLE "ocr_supplier_aliases"
    ADD CONSTRAINT "ocr_supplier_aliases_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "ocr_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ocr_item_aliases"
    ADD CONSTRAINT "ocr_item_aliases_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "ocr_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ocr_invoices"
    ADD CONSTRAINT "ocr_invoices_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "ocr_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ocr_invoice_lines"
    ADD CONSTRAINT "ocr_invoice_lines_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "ocr_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ocr_invoice_lines"
    ADD CONSTRAINT "ocr_invoice_lines_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "ocr_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ocr_price_history"
    ADD CONSTRAINT "ocr_price_history_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "ocr_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ocr_price_history"
    ADD CONSTRAINT "ocr_price_history_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "ocr_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ocr_correction_rules"
    ADD CONSTRAINT "ocr_correction_rules_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "ocr_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ocr_extraction_logs"
    ADD CONSTRAINT "ocr_extraction_logs_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "ocr_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

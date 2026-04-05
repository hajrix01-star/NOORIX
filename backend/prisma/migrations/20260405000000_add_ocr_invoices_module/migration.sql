-- CreateTable: OCR Invoices Module
-- Migration created manually to add OCR experimental tables

CREATE TABLE IF NOT EXISTS "ocr_suppliers" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "tax_number" TEXT,
    "phone" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ocr_supplier_aliases" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "alias_type" TEXT NOT NULL DEFAULT 'correction',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_supplier_aliases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ocr_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "category" TEXT,
    "unit_type" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ocr_item_aliases" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "alias_type" TEXT NOT NULL DEFAULT 'correction',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_item_aliases_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ocr_invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "invoice_number" TEXT,
    "invoice_date" TIMESTAMP(3),
    "total_amount" DECIMAL(15,2),
    "vat_amount" DECIMAL(15,2),
    "tax_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "raw_extraction" JSONB,
    "confidence" DOUBLE PRECISION,
    "image_url" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_invoices_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ocr_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "item_id" TEXT,
    "raw_name" TEXT NOT NULL,
    "matched_name" TEXT,
    "quantity" DECIMAL(15,3),
    "unit_price" DECIMAL(15,2),
    "total_price" DECIMAL(15,2),
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ocr_price_history" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "invoice_id" TEXT,
    "invoice_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_price_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ocr_correction_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "supplier_id" TEXT,
    "raw_text" TEXT NOT NULL,
    "corrected_text" TEXT NOT NULL,
    "occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_correction_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ocr_extraction_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "supplier_id" TEXT,
    "raw_text" TEXT,
    "extraction_data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error_message" TEXT,
    "processing_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_extraction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ocr_suppliers_tenant_id_idx" ON "ocr_suppliers"("tenant_id");
CREATE INDEX IF NOT EXISTS "ocr_supplier_aliases_supplier_id_idx" ON "ocr_supplier_aliases"("supplier_id");
CREATE INDEX IF NOT EXISTS "ocr_items_tenant_id_idx" ON "ocr_items"("tenant_id");
CREATE INDEX IF NOT EXISTS "ocr_item_aliases_item_id_idx" ON "ocr_item_aliases"("item_id");
CREATE INDEX IF NOT EXISTS "ocr_invoices_tenant_id_idx" ON "ocr_invoices"("tenant_id");
CREATE INDEX IF NOT EXISTS "ocr_invoice_lines_invoice_id_idx" ON "ocr_invoice_lines"("invoice_id");
CREATE INDEX IF NOT EXISTS "ocr_price_history_tenant_id_idx" ON "ocr_price_history"("tenant_id");
CREATE INDEX IF NOT EXISTS "ocr_price_history_item_id_idx" ON "ocr_price_history"("item_id");
CREATE INDEX IF NOT EXISTS "ocr_correction_rules_tenant_id_idx" ON "ocr_correction_rules"("tenant_id");
CREATE INDEX IF NOT EXISTS "ocr_extraction_logs_tenant_id_idx" ON "ocr_extraction_logs"("tenant_id");

-- AddForeignKey
ALTER TABLE "ocr_supplier_aliases" ADD CONSTRAINT "ocr_supplier_aliases_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "ocr_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ocr_item_aliases" ADD CONSTRAINT "ocr_item_aliases_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "ocr_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ocr_invoice_lines" ADD CONSTRAINT "ocr_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "ocr_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ocr_invoice_lines" ADD CONSTRAINT "ocr_invoice_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "ocr_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ocr_invoices" ADD CONSTRAINT "ocr_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "ocr_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ocr_price_history" ADD CONSTRAINT "ocr_price_history_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "ocr_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ocr_price_history" ADD CONSTRAINT "ocr_price_history_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "ocr_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ocr_price_history" ADD CONSTRAINT "ocr_price_history_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "ocr_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ocr_correction_rules" ADD CONSTRAINT "ocr_correction_rules_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "ocr_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ocr_extraction_logs" ADD CONSTRAINT "ocr_extraction_logs_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "ocr_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ocr_extraction_logs" ADD CONSTRAINT "ocr_extraction_logs_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "ocr_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

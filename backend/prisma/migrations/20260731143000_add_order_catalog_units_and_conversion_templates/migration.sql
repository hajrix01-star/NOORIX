CREATE TABLE IF NOT EXISTS "order_catalog_units" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "name_en" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'package',
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "order_catalog_units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "order_conversion_templates" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "name_en" TEXT,
  "description" TEXT,
  "conversions" JSONB,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "order_conversion_templates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "order_products"
ADD COLUMN IF NOT EXISTS "conversion_template_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_catalog_units_company_id_fkey'
  ) THEN
    ALTER TABLE "order_catalog_units"
    ADD CONSTRAINT "order_catalog_units_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_conversion_templates_company_id_fkey'
  ) THEN
    ALTER TABLE "order_conversion_templates"
    ADD CONSTRAINT "order_conversion_templates_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_products_conversion_template_id_fkey'
  ) THEN
    ALTER TABLE "order_products"
    ADD CONSTRAINT "order_products_conversion_template_id_fkey"
    FOREIGN KEY ("conversion_template_id") REFERENCES "order_conversion_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "order_catalog_units_company_id_code_key"
ON "order_catalog_units"("company_id", "code");

CREATE INDEX IF NOT EXISTS "order_catalog_units_tenant_id_idx"
ON "order_catalog_units"("tenant_id");

CREATE INDEX IF NOT EXISTS "order_catalog_units_company_id_idx"
ON "order_catalog_units"("company_id");

CREATE UNIQUE INDEX IF NOT EXISTS "order_conversion_templates_company_id_code_key"
ON "order_conversion_templates"("company_id", "code");

CREATE INDEX IF NOT EXISTS "order_conversion_templates_tenant_id_idx"
ON "order_conversion_templates"("tenant_id");

CREATE INDEX IF NOT EXISTS "order_conversion_templates_company_id_idx"
ON "order_conversion_templates"("company_id");

CREATE INDEX IF NOT EXISTS "order_products_company_id_conversion_template_id_idx"
ON "order_products"("company_id", "conversion_template_id");

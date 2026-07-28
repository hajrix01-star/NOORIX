-- Additive supplier-directory migration.
-- Existing suppliers, invoices, balances, tax amounts, and E2-9 categories are untouched.

CREATE TABLE "supplier_directory_entries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "aliases" JSONB NOT NULL,
    "search_text" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "default_category_code" TEXT NOT NULL,
    "is_tax_registered" BOOLEAN NOT NULL DEFAULT false,
    "tax_number" TEXT,
    "supplier_invoice_number_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "supplier_directory_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_directory_entries_code_key"
    ON "supplier_directory_entries"("code");
CREATE INDEX "supplier_directory_entries_entity_type_sort_order_idx"
    ON "supplier_directory_entries"("entity_type", "sort_order");
CREATE INDEX "supplier_directory_entries_default_category_code_idx"
    ON "supplier_directory_entries"("default_category_code");

ALTER TABLE "suppliers"
    ADD COLUMN "directory_entry_id" TEXT,
    ADD COLUMN "directory_managed" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX "suppliers_company_id_directory_entry_id_key"
    ON "suppliers"("company_id", "directory_entry_id");
CREATE INDEX "suppliers_directory_entry_id_idx"
    ON "suppliers"("directory_entry_id");

ALTER TABLE "suppliers"
    ADD CONSTRAINT "suppliers_directory_entry_id_fkey"
    FOREIGN KEY ("directory_entry_id")
    REFERENCES "supplier_directory_entries"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- Add canonical categories only to operating companies.
-- E2-9 is deliberately reserved as historical and SHAMI TAX is excluded.
INSERT INTO "categories"
    ("id", "tenant_id", "company_id", "account_id", "code", "name_ar", "name_en",
     "parent_id", "type", "icon", "is_active", "sort_order", "created_at", "updated_at")
SELECT
    'seed_e2_8_' || md5(c."id"), c."tenant_id", c."id", p."account_id",
    'E2-8', 'GOSI', 'GOSI', p."id", p."type", NULL, true, 7,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
JOIN "categories" p ON p."company_id" = c."id" AND p."code" = 'EXP-002'
WHERE upper(regexp_replace(coalesce(c."name_ar", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND upper(regexp_replace(coalesce(c."name_en", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND NOT EXISTS (
      SELECT 1 FROM "categories" x WHERE x."company_id" = c."id" AND x."code" = 'E2-8'
  );

INSERT INTO "categories"
    ("id", "tenant_id", "company_id", "account_id", "code", "name_ar", "name_en",
     "parent_id", "type", "icon", "is_active", "sort_order", "created_at", "updated_at")
SELECT
    'seed_e2_10_' || md5(c."id"), c."tenant_id", c."id", p."account_id",
    'E2-10', 'رسوم منصات حكومية', 'Government Platform Fees',
    p."id", p."type", NULL, true, 9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
JOIN "categories" p ON p."company_id" = c."id" AND p."code" = 'EXP-002'
WHERE upper(regexp_replace(coalesce(c."name_ar", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND upper(regexp_replace(coalesce(c."name_en", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND NOT EXISTS (
      SELECT 1 FROM "categories" x WHERE x."company_id" = c."id" AND x."code" = 'E2-10'
  );

INSERT INTO "categories"
    ("id", "tenant_id", "company_id", "account_id", "code", "name_ar", "name_en",
     "parent_id", "type", "icon", "is_active", "sort_order", "created_at", "updated_at")
SELECT
    'seed_e2_11_' || md5(c."id"), c."tenant_id", c."id", p."account_id",
    'E2-11', 'شهادات صحية وتصاريح موظفين', 'Health Certificates & Employee Permits',
    p."id", p."type", NULL, true, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "companies" c
JOIN "categories" p ON p."company_id" = c."id" AND p."code" = 'EXP-002'
WHERE upper(regexp_replace(coalesce(c."name_ar", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND upper(regexp_replace(coalesce(c."name_en", ''), '\s+', '', 'g')) <> 'SHAMITAX'
  AND NOT EXISTS (
      SELECT 1 FROM "categories" x WHERE x."company_id" = c."id" AND x."code" = 'E2-11'
  );

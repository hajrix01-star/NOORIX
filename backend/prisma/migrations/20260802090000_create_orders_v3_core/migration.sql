-- Orders Core V3 is a physically isolated domain. No V3 foreign key targets a
-- legacy orders table; only platform-owned companies/users are referenced.

CREATE TABLE "orders_v3_units" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "name_en" TEXT,
  "dimension" TEXT NOT NULL,
  "canonical_factor" DECIMAL(24,12),
  "decimal_scale" INTEGER NOT NULL DEFAULT 6,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_v3_units_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_units_factor_check" CHECK ("canonical_factor" IS NULL OR "canonical_factor" > 0),
  CONSTRAINT "orders_v3_units_scale_check" CHECK ("decimal_scale" BETWEEN 0 AND 8)
);

CREATE TABLE "orders_v3_categories" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "name_en" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_v3_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders_v3_sections" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "name_en" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_v3_sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders_v3_items" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "sku" TEXT,
  "name_ar" TEXT NOT NULL,
  "name_en" TEXT,
  "item_type" TEXT NOT NULL DEFAULT 'purchased',
  "category_id" TEXT,
  "base_unit_id" TEXT NOT NULL,
  "track_inventory" BOOLEAN NOT NULL DEFAULT true,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_v3_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_items_type_check" CHECK ("item_type" IN ('purchased', 'sale', 'both'))
);

CREATE TABLE "orders_v3_item_sections" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "section_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_v3_item_sections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders_v3_conversion_versions" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "content_hash" TEXT NOT NULL,
  "provenance" TEXT NOT NULL DEFAULT 'catalog',
  "published_at" TIMESTAMP(3),
  "retired_at" TIMESTAMP(3),
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_v3_conversion_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_conversion_version_check" CHECK ("version" > 0),
  CONSTRAINT "orders_v3_conversion_status_check" CHECK ("status" IN ('draft', 'published', 'retired'))
);

CREATE TABLE "orders_v3_conversion_edges" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "version_id" TEXT NOT NULL,
  "from_unit_id" TEXT NOT NULL,
  "to_unit_id" TEXT NOT NULL,
  "factor" DECIMAL(24,12) NOT NULL,
  "reversible" BOOLEAN NOT NULL DEFAULT true,
  "allow_dimension_bridge" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_v3_conversion_edges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_conversion_factor_check" CHECK ("factor" > 0),
  CONSTRAINT "orders_v3_conversion_units_check" CHECK ("from_unit_id" <> "to_unit_id")
);

CREATE TABLE "orders_v3_recipe_versions" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "output_item_id" TEXT NOT NULL,
  "output_quantity" DECIMAL(24,8) NOT NULL,
  "output_unit_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'draft',
  "content_hash" TEXT NOT NULL,
  "published_at" TIMESTAMP(3),
  "retired_at" TIMESTAMP(3),
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_v3_recipe_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_recipe_output_check" CHECK ("output_quantity" > 0 AND "version" > 0),
  CONSTRAINT "orders_v3_recipe_status_check" CHECK ("status" IN ('draft', 'published', 'retired'))
);

CREATE TABLE "orders_v3_recipe_lines" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "recipe_version_id" TEXT NOT NULL,
  "component_item_id" TEXT NOT NULL,
  "quantity" DECIMAL(24,8) NOT NULL,
  "unit_id" TEXT NOT NULL,
  "waste_percent" DECIMAL(9,6) NOT NULL DEFAULT 0,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_v3_recipe_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_recipe_line_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "orders_v3_recipe_line_waste_check" CHECK ("waste_percent" >= 0 AND "waste_percent" < 100)
);

CREATE TABLE "orders_v3_locations" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "name_en" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'warehouse',
  "section_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_v3_locations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_location_kind_check" CHECK ("kind" IN ('warehouse', 'section', 'virtual'))
);

CREATE TABLE "orders_v3_documents" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "document_number" TEXT NOT NULL,
  "document_type" TEXT NOT NULL,
  "payment_method" TEXT,
  "document_date" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'posted',
  "section_id" TEXT,
  "location_id" TEXT NOT NULL,
  "petty_cash_amount" DECIMAL(20,6),
  "subtotal" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "calculation_version" INTEGER NOT NULL DEFAULT 1,
  "calculation_snapshot" JSONB NOT NULL,
  "reversal_of_id" TEXT,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "orders_v3_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_document_type_check" CHECK ("document_type" IN ('purchase', 'registration')),
  CONSTRAINT "orders_v3_document_status_check" CHECK ("status" IN ('draft', 'posted', 'reversed')),
  CONSTRAINT "orders_v3_payment_check" CHECK ("payment_method" IS NULL OR "payment_method" IN ('external', 'internal', 'transfer'))
);

CREATE TABLE "orders_v3_document_lines" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "line_number" INTEGER NOT NULL,
  "item_name_snapshot" TEXT NOT NULL,
  "input_quantity" DECIMAL(24,8) NOT NULL,
  "input_unit_id" TEXT NOT NULL,
  "base_quantity" DECIMAL(24,8) NOT NULL,
  "unit_price" DECIMAL(20,6) NOT NULL DEFAULT 0,
  "price_unit_id" TEXT NOT NULL,
  "price_quantity" DECIMAL(24,8) NOT NULL,
  "line_total" DECIMAL(20,6) NOT NULL,
  "conversion_version_id" TEXT,
  "recipe_version_id" TEXT,
  "conversion_snapshot" JSONB NOT NULL,
  "calculation_snapshot" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_v3_document_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_document_line_quantity_check" CHECK ("input_quantity" > 0 AND "base_quantity" > 0),
  CONSTRAINT "orders_v3_document_line_price_check" CHECK ("unit_price" >= 0)
);

CREATE TABLE "orders_v3_ledger_entries" (
  "id" TEXT NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "document_line_id" TEXT,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "entry_type" TEXT NOT NULL,
  "quantity_delta" DECIMAL(24,8) NOT NULL,
  "unit_cost" DECIMAL(20,8) NOT NULL,
  "value_delta" DECIMAL(20,6) NOT NULL,
  "quantity_after" DECIMAL(24,8) NOT NULL,
  "value_after" DECIMAL(20,6) NOT NULL,
  "average_unit_cost_after" DECIMAL(20,8) NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "source_key" TEXT NOT NULL,
  "source_snapshot" JSONB NOT NULL,
  "conversion_version_id" TEXT,
  "recipe_version_id" TEXT,
  "reversal_of_id" TEXT,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_v3_ledger_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_ledger_entry_type_check" CHECK ("entry_type" IN ('receipt', 'issue', 'transfer_in', 'transfer_out', 'stocktake_adjustment', 'reversal')),
  CONSTRAINT "orders_v3_ledger_quantity_check" CHECK ("quantity_delta" <> 0),
  CONSTRAINT "orders_v3_ledger_cost_check" CHECK ("unit_cost" >= 0 AND "average_unit_cost_after" >= 0)
);

CREATE TABLE "orders_v3_stocktakes" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "stocktake_number" TEXT NOT NULL,
  "stocktake_date" DATE NOT NULL,
  "location_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'posted',
  "notes" TEXT,
  "idempotency_key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_v3_stocktakes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_stocktake_status_check" CHECK ("status" IN ('posted', 'reversed'))
);

CREATE TABLE "orders_v3_stocktake_lines" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "stocktake_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "unit_id" TEXT NOT NULL,
  "expected_quantity" DECIMAL(24,8) NOT NULL,
  "physical_quantity" DECIMAL(24,8) NOT NULL,
  "variance_quantity" DECIMAL(24,8) NOT NULL,
  "unit_cost" DECIMAL(20,8) NOT NULL,
  "variance_value" DECIMAL(20,6) NOT NULL,
  CONSTRAINT "orders_v3_stocktake_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_stocktake_physical_check" CHECK ("physical_quantity" >= 0)
);

CREATE TABLE "orders_v3_migration_map" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "source_entity" TEXT NOT NULL,
  "source_id" TEXT NOT NULL,
  "target_entity" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "source_checksum" TEXT NOT NULL,
  "migration_run_id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'verified',
  "migrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "orders_v3_migration_map_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "orders_v3_migration_status_check" CHECK ("status" IN ('pending', 'migrated', 'verified', 'failed'))
);

CREATE UNIQUE INDEX "orders_v3_units_company_code_key" ON "orders_v3_units"("company_id", "code");
CREATE UNIQUE INDEX "orders_v3_categories_company_name_key" ON "orders_v3_categories"("company_id", "name_ar");
CREATE UNIQUE INDEX "orders_v3_sections_company_code_key" ON "orders_v3_sections"("company_id", "code");
CREATE UNIQUE INDEX "orders_v3_items_company_sku_key" ON "orders_v3_items"("company_id", "sku");
CREATE UNIQUE INDEX "orders_v3_item_sections_item_section_key" ON "orders_v3_item_sections"("item_id", "section_id");
CREATE UNIQUE INDEX "orders_v3_conversion_versions_item_version_key" ON "orders_v3_conversion_versions"("item_id", "version");
CREATE UNIQUE INDEX "orders_v3_conversion_versions_item_hash_key" ON "orders_v3_conversion_versions"("item_id", "content_hash");
CREATE UNIQUE INDEX "orders_v3_conversion_edges_version_units_key" ON "orders_v3_conversion_edges"("version_id", "from_unit_id", "to_unit_id");
CREATE UNIQUE INDEX "orders_v3_recipe_versions_item_version_key" ON "orders_v3_recipe_versions"("output_item_id", "version");
CREATE UNIQUE INDEX "orders_v3_recipe_versions_item_hash_key" ON "orders_v3_recipe_versions"("output_item_id", "content_hash");
CREATE UNIQUE INDEX "orders_v3_recipe_lines_version_component_key" ON "orders_v3_recipe_lines"("recipe_version_id", "component_item_id");
CREATE UNIQUE INDEX "orders_v3_locations_company_code_key" ON "orders_v3_locations"("company_id", "code");
CREATE UNIQUE INDEX "orders_v3_documents_company_number_key" ON "orders_v3_documents"("company_id", "document_number");
CREATE UNIQUE INDEX "orders_v3_documents_company_idempotency_key" ON "orders_v3_documents"("company_id", "idempotency_key");
CREATE UNIQUE INDEX "orders_v3_documents_reversal_key" ON "orders_v3_documents"("reversal_of_id") WHERE "reversal_of_id" IS NOT NULL;
CREATE UNIQUE INDEX "orders_v3_document_lines_document_number_key" ON "orders_v3_document_lines"("document_id", "line_number");
CREATE UNIQUE INDEX "orders_v3_ledger_sequence_key" ON "orders_v3_ledger_entries"("sequence");
CREATE UNIQUE INDEX "orders_v3_ledger_company_source_key" ON "orders_v3_ledger_entries"("company_id", "source_key");
CREATE UNIQUE INDEX "orders_v3_ledger_reversal_key" ON "orders_v3_ledger_entries"("reversal_of_id") WHERE "reversal_of_id" IS NOT NULL;
CREATE UNIQUE INDEX "orders_v3_stocktakes_company_number_key" ON "orders_v3_stocktakes"("company_id", "stocktake_number");
CREATE UNIQUE INDEX "orders_v3_stocktakes_company_idempotency_key" ON "orders_v3_stocktakes"("company_id", "idempotency_key");
CREATE UNIQUE INDEX "orders_v3_stocktake_lines_stocktake_item_key" ON "orders_v3_stocktake_lines"("stocktake_id", "item_id");
CREATE UNIQUE INDEX "orders_v3_migration_source_key" ON "orders_v3_migration_map"("company_id", "source_entity", "source_id");

CREATE INDEX "orders_v3_items_company_type_active_idx" ON "orders_v3_items"("company_id", "item_type", "is_active");
CREATE INDEX "orders_v3_conversion_versions_lookup_idx" ON "orders_v3_conversion_versions"("company_id", "item_id", "status");
CREATE INDEX "orders_v3_recipe_versions_lookup_idx" ON "orders_v3_recipe_versions"("company_id", "output_item_id", "status");
CREATE INDEX "orders_v3_documents_range_idx" ON "orders_v3_documents"("company_id", "document_type", "document_date");
CREATE INDEX "orders_v3_document_lines_item_idx" ON "orders_v3_document_lines"("company_id", "item_id");
CREATE INDEX "orders_v3_ledger_balance_idx" ON "orders_v3_ledger_entries"("company_id", "item_id", "location_id", "sequence");
CREATE INDEX "orders_v3_ledger_effective_idx" ON "orders_v3_ledger_entries"("company_id", "effective_at");
CREATE INDEX "orders_v3_migration_run_idx" ON "orders_v3_migration_map"("company_id", "migration_run_id", "status");

ALTER TABLE "orders_v3_items" ADD CONSTRAINT "orders_v3_items_category_fkey" FOREIGN KEY ("category_id") REFERENCES "orders_v3_categories"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_items" ADD CONSTRAINT "orders_v3_items_base_unit_fkey" FOREIGN KEY ("base_unit_id") REFERENCES "orders_v3_units"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_item_sections" ADD CONSTRAINT "orders_v3_item_sections_item_fkey" FOREIGN KEY ("item_id") REFERENCES "orders_v3_items"("id") ON DELETE CASCADE;
ALTER TABLE "orders_v3_item_sections" ADD CONSTRAINT "orders_v3_item_sections_section_fkey" FOREIGN KEY ("section_id") REFERENCES "orders_v3_sections"("id") ON DELETE CASCADE;
ALTER TABLE "orders_v3_conversion_versions" ADD CONSTRAINT "orders_v3_conversion_versions_item_fkey" FOREIGN KEY ("item_id") REFERENCES "orders_v3_items"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_conversion_versions" ADD CONSTRAINT "orders_v3_conversion_versions_user_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "orders_v3_conversion_edges" ADD CONSTRAINT "orders_v3_conversion_edges_version_fkey" FOREIGN KEY ("version_id") REFERENCES "orders_v3_conversion_versions"("id") ON DELETE CASCADE;
ALTER TABLE "orders_v3_conversion_edges" ADD CONSTRAINT "orders_v3_conversion_edges_from_unit_fkey" FOREIGN KEY ("from_unit_id") REFERENCES "orders_v3_units"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_conversion_edges" ADD CONSTRAINT "orders_v3_conversion_edges_to_unit_fkey" FOREIGN KEY ("to_unit_id") REFERENCES "orders_v3_units"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_recipe_versions" ADD CONSTRAINT "orders_v3_recipe_versions_item_fkey" FOREIGN KEY ("output_item_id") REFERENCES "orders_v3_items"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_recipe_versions" ADD CONSTRAINT "orders_v3_recipe_versions_unit_fkey" FOREIGN KEY ("output_unit_id") REFERENCES "orders_v3_units"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_recipe_versions" ADD CONSTRAINT "orders_v3_recipe_versions_user_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "orders_v3_recipe_lines" ADD CONSTRAINT "orders_v3_recipe_lines_version_fkey" FOREIGN KEY ("recipe_version_id") REFERENCES "orders_v3_recipe_versions"("id") ON DELETE CASCADE;
ALTER TABLE "orders_v3_recipe_lines" ADD CONSTRAINT "orders_v3_recipe_lines_item_fkey" FOREIGN KEY ("component_item_id") REFERENCES "orders_v3_items"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_recipe_lines" ADD CONSTRAINT "orders_v3_recipe_lines_unit_fkey" FOREIGN KEY ("unit_id") REFERENCES "orders_v3_units"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_locations" ADD CONSTRAINT "orders_v3_locations_section_fkey" FOREIGN KEY ("section_id") REFERENCES "orders_v3_sections"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_documents" ADD CONSTRAINT "orders_v3_documents_section_fkey" FOREIGN KEY ("section_id") REFERENCES "orders_v3_sections"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_documents" ADD CONSTRAINT "orders_v3_documents_location_fkey" FOREIGN KEY ("location_id") REFERENCES "orders_v3_locations"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_documents" ADD CONSTRAINT "orders_v3_documents_reversal_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "orders_v3_documents"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_documents" ADD CONSTRAINT "orders_v3_documents_user_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "orders_v3_document_lines" ADD CONSTRAINT "orders_v3_document_lines_document_fkey" FOREIGN KEY ("document_id") REFERENCES "orders_v3_documents"("id") ON DELETE CASCADE;
ALTER TABLE "orders_v3_document_lines" ADD CONSTRAINT "orders_v3_document_lines_item_fkey" FOREIGN KEY ("item_id") REFERENCES "orders_v3_items"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_document_lines" ADD CONSTRAINT "orders_v3_document_lines_input_unit_fkey" FOREIGN KEY ("input_unit_id") REFERENCES "orders_v3_units"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_document_lines" ADD CONSTRAINT "orders_v3_document_lines_price_unit_fkey" FOREIGN KEY ("price_unit_id") REFERENCES "orders_v3_units"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_document_lines" ADD CONSTRAINT "orders_v3_document_lines_conversion_fkey" FOREIGN KEY ("conversion_version_id") REFERENCES "orders_v3_conversion_versions"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_document_lines" ADD CONSTRAINT "orders_v3_document_lines_recipe_fkey" FOREIGN KEY ("recipe_version_id") REFERENCES "orders_v3_recipe_versions"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_ledger_entries" ADD CONSTRAINT "orders_v3_ledger_item_fkey" FOREIGN KEY ("item_id") REFERENCES "orders_v3_items"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_ledger_entries" ADD CONSTRAINT "orders_v3_ledger_location_fkey" FOREIGN KEY ("location_id") REFERENCES "orders_v3_locations"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_ledger_entries" ADD CONSTRAINT "orders_v3_ledger_document_line_fkey" FOREIGN KEY ("document_line_id") REFERENCES "orders_v3_document_lines"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_ledger_entries" ADD CONSTRAINT "orders_v3_ledger_conversion_fkey" FOREIGN KEY ("conversion_version_id") REFERENCES "orders_v3_conversion_versions"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_ledger_entries" ADD CONSTRAINT "orders_v3_ledger_recipe_fkey" FOREIGN KEY ("recipe_version_id") REFERENCES "orders_v3_recipe_versions"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_ledger_entries" ADD CONSTRAINT "orders_v3_ledger_reversal_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "orders_v3_ledger_entries"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_ledger_entries" ADD CONSTRAINT "orders_v3_ledger_user_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "orders_v3_stocktakes" ADD CONSTRAINT "orders_v3_stocktakes_location_fkey" FOREIGN KEY ("location_id") REFERENCES "orders_v3_locations"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_stocktakes" ADD CONSTRAINT "orders_v3_stocktakes_user_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
ALTER TABLE "orders_v3_stocktake_lines" ADD CONSTRAINT "orders_v3_stocktake_lines_stocktake_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "orders_v3_stocktakes"("id") ON DELETE CASCADE;
ALTER TABLE "orders_v3_stocktake_lines" ADD CONSTRAINT "orders_v3_stocktake_lines_item_fkey" FOREIGN KEY ("item_id") REFERENCES "orders_v3_items"("id") ON DELETE RESTRICT;
ALTER TABLE "orders_v3_stocktake_lines" ADD CONSTRAINT "orders_v3_stocktake_lines_unit_fkey" FOREIGN KEY ("unit_id") REFERENCES "orders_v3_units"("id") ON DELETE RESTRICT;

-- Every V3 row carries company/tenant scope. These triggers reject cross-scope
-- references even if an application bug passes a valid foreign id.
CREATE OR REPLACE FUNCTION orders_v3_validate_scope() RETURNS trigger AS $$
DECLARE parent_tenant TEXT; parent_company TEXT;
BEGIN
  IF NEW."company_id" IS NULL OR NEW."tenant_id" IS NULL THEN
    RAISE EXCEPTION 'Orders V3 scope is required';
  END IF;
  SELECT "tenant_id" INTO parent_tenant FROM "companies" WHERE "id" = NEW."company_id";
  IF parent_tenant IS DISTINCT FROM NEW."tenant_id" THEN
    RAISE EXCEPTION 'Orders V3 tenant/company scope mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION orders_v3_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Orders V3 audit rows are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_v3_ledger_immutable BEFORE UPDATE OR DELETE ON "orders_v3_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION orders_v3_reject_mutation();
CREATE TRIGGER orders_v3_document_lines_immutable BEFORE UPDATE OR DELETE ON "orders_v3_document_lines"
  FOR EACH ROW EXECUTE FUNCTION orders_v3_reject_mutation();

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'orders_v3_units', 'orders_v3_categories', 'orders_v3_sections', 'orders_v3_items',
    'orders_v3_item_sections', 'orders_v3_conversion_versions', 'orders_v3_conversion_edges',
    'orders_v3_recipe_versions', 'orders_v3_recipe_lines', 'orders_v3_locations',
    'orders_v3_documents', 'orders_v3_document_lines', 'orders_v3_ledger_entries',
    'orders_v3_stocktakes', 'orders_v3_stocktake_lines', 'orders_v3_migration_map'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I_scope BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION orders_v3_validate_scope()', table_name, table_name);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I_tenant_select ON %I FOR SELECT USING (tenant_id = current_tenant_id())', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_tenant_insert ON %I FOR INSERT WITH CHECK (tenant_id = current_tenant_id())', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_tenant_update ON %I FOR UPDATE USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id())', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_tenant_delete ON %I FOR DELETE USING (tenant_id = current_tenant_id())', table_name, table_name);
  END LOOP;
END $$;

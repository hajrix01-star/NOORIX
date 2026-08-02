-- Orders V4 independent operational domain. No legacy Orders/V3 tables are altered.

-- CreateTable
CREATE TABLE "orders_v4_units" (
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

    CONSTRAINT "orders_v4_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_v4_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_sections" (
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

    CONSTRAINT "orders_v4_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "sku" TEXT,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "item_type" TEXT NOT NULL,
    "category_id" TEXT,
    "inventory_unit_id" TEXT NOT NULL,
    "track_inventory" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_v4_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_item_units" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "is_order_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_price" DECIMAL(20,6),
    "last_price_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_v4_item_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_item_sections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_v4_item_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_conversion_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "content_hash" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_v4_conversion_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_conversion_edges" (
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

    CONSTRAINT "orders_v4_conversion_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_recipe_versions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "output_item_id" TEXT NOT NULL,
    "output_quantity" DECIMAL(24,8) NOT NULL,
    "output_unit_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'published',
    "content_hash" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "retired_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_v4_recipe_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_recipe_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "recipe_version_id" TEXT NOT NULL,
    "component_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(24,8) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_v4_recipe_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_locations" (
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

    CONSTRAINT "orders_v4_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_documents" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "document_number" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'prepared',
    "payment_method" TEXT,
    "document_date" DATE NOT NULL,
    "section_id" TEXT,
    "location_id" TEXT NOT NULL,
    "petty_cash_amount" DECIMAL(20,6),
    "subtotal" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "calculation_version" INTEGER NOT NULL DEFAULT 1,
    "calculation_snapshot" JSONB NOT NULL,
    "reversal_of_id" TEXT,
    "received_at" TIMESTAMP(3),
    "received_by_user_id" TEXT,
    "created_by_user_id" TEXT,
    "updated_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_v4_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_document_lines" (
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
    "recipe_snapshot" JSONB,
    "cost_snapshot" JSONB,
    "calculation_snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_v4_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_price_history" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "document_line_id" TEXT NOT NULL,
    "unit_price" DECIMAL(20,6) NOT NULL,
    "inventory_unit_price" DECIMAL(20,8) NOT NULL,
    "conversion_version_id" TEXT,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_v4_price_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_inventory_ledger" (
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

    CONSTRAINT "orders_v4_inventory_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_custody_ledger" (
    "id" TEXT NOT NULL,
    "sequence" BIGSERIAL NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "document_id" TEXT,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "entry_type" TEXT NOT NULL,
    "amount_delta" DECIMAL(20,6) NOT NULL,
    "balance_after" DECIMAL(20,6) NOT NULL,
    "source_key" TEXT NOT NULL,
    "source_snapshot" JSONB NOT NULL,
    "reversal_of_id" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_v4_custody_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_stocktakes" (
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

    CONSTRAINT "orders_v4_stocktakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_stocktake_lines" (
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

    CONSTRAINT "orders_v4_stocktake_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders_v4_migration_map" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "source_system" TEXT NOT NULL,
    "source_entity" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_entity" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "source_checksum" TEXT NOT NULL,
    "migration_run_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "detail" JSONB,
    "migrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_v4_migration_map_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "orders_v4_units_tenant_id_idx" ON "orders_v4_units"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_units_company_id_dimension_is_active_idx" ON "orders_v4_units"("company_id", "dimension", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_units_company_id_code_key" ON "orders_v4_units"("company_id", "code");

-- CreateIndex
CREATE INDEX "orders_v4_categories_tenant_id_idx" ON "orders_v4_categories"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_categories_company_id_is_active_idx" ON "orders_v4_categories"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_categories_company_id_name_ar_key" ON "orders_v4_categories"("company_id", "name_ar");

-- CreateIndex
CREATE INDEX "orders_v4_sections_tenant_id_idx" ON "orders_v4_sections"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_sections_company_id_is_active_idx" ON "orders_v4_sections"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_sections_company_id_code_key" ON "orders_v4_sections"("company_id", "code");

-- CreateIndex
CREATE INDEX "orders_v4_items_tenant_id_idx" ON "orders_v4_items"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_items_company_id_item_type_is_active_idx" ON "orders_v4_items"("company_id", "item_type", "is_active");

-- CreateIndex
CREATE INDEX "orders_v4_items_category_id_idx" ON "orders_v4_items"("category_id");

-- CreateIndex
CREATE INDEX "orders_v4_items_inventory_unit_id_idx" ON "orders_v4_items"("inventory_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_items_company_id_sku_key" ON "orders_v4_items"("company_id", "sku");

-- CreateIndex
CREATE INDEX "orders_v4_item_units_tenant_id_idx" ON "orders_v4_item_units"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_item_units_company_id_item_id_is_active_idx" ON "orders_v4_item_units"("company_id", "item_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_item_units_item_id_unit_id_key" ON "orders_v4_item_units"("item_id", "unit_id");

-- CreateIndex
CREATE INDEX "orders_v4_item_sections_tenant_id_idx" ON "orders_v4_item_sections"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_item_sections_company_id_section_id_idx" ON "orders_v4_item_sections"("company_id", "section_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_item_sections_item_id_section_id_key" ON "orders_v4_item_sections"("item_id", "section_id");

-- CreateIndex
CREATE INDEX "orders_v4_conversion_versions_tenant_id_idx" ON "orders_v4_conversion_versions"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_conversion_versions_company_id_item_id_status_idx" ON "orders_v4_conversion_versions"("company_id", "item_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_conversion_versions_item_id_version_key" ON "orders_v4_conversion_versions"("item_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_conversion_versions_item_id_content_hash_key" ON "orders_v4_conversion_versions"("item_id", "content_hash");

-- CreateIndex
CREATE INDEX "orders_v4_conversion_edges_tenant_id_idx" ON "orders_v4_conversion_edges"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_conversion_edges_company_id_version_id_idx" ON "orders_v4_conversion_edges"("company_id", "version_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_conversion_edges_version_id_from_unit_id_to_unit__key" ON "orders_v4_conversion_edges"("version_id", "from_unit_id", "to_unit_id");

-- CreateIndex
CREATE INDEX "orders_v4_recipe_versions_tenant_id_idx" ON "orders_v4_recipe_versions"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_recipe_versions_company_id_output_item_id_status_idx" ON "orders_v4_recipe_versions"("company_id", "output_item_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_recipe_versions_output_item_id_version_key" ON "orders_v4_recipe_versions"("output_item_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_recipe_versions_output_item_id_content_hash_key" ON "orders_v4_recipe_versions"("output_item_id", "content_hash");

-- CreateIndex
CREATE INDEX "orders_v4_recipe_lines_tenant_id_idx" ON "orders_v4_recipe_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_recipe_lines_company_id_component_item_id_idx" ON "orders_v4_recipe_lines"("company_id", "component_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_recipe_lines_recipe_version_id_component_item_id__key" ON "orders_v4_recipe_lines"("recipe_version_id", "component_item_id", "unit_id");

-- CreateIndex
CREATE INDEX "orders_v4_locations_tenant_id_idx" ON "orders_v4_locations"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_locations_company_id_is_active_idx" ON "orders_v4_locations"("company_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_locations_company_id_code_key" ON "orders_v4_locations"("company_id", "code");

-- CreateIndex
CREATE INDEX "orders_v4_documents_tenant_id_idx" ON "orders_v4_documents"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_documents_company_id_document_type_document_date_idx" ON "orders_v4_documents"("company_id", "document_type", "document_date");

-- CreateIndex
CREATE INDEX "orders_v4_documents_company_id_status_created_at_idx" ON "orders_v4_documents"("company_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_documents_company_id_document_number_key" ON "orders_v4_documents"("company_id", "document_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_documents_company_id_idempotency_key_key" ON "orders_v4_documents"("company_id", "idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_documents_reversal_of_id_key" ON "orders_v4_documents"("reversal_of_id");

-- CreateIndex
CREATE INDEX "orders_v4_document_lines_tenant_id_idx" ON "orders_v4_document_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_document_lines_company_id_item_id_idx" ON "orders_v4_document_lines"("company_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_document_lines_document_id_line_number_key" ON "orders_v4_document_lines"("document_id", "line_number");

-- CreateIndex
CREATE INDEX "orders_v4_price_history_tenant_id_idx" ON "orders_v4_price_history"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_price_history_company_id_item_id_effective_at_idx" ON "orders_v4_price_history"("company_id", "item_id", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_price_history_document_line_id_key" ON "orders_v4_price_history"("document_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_inventory_ledger_sequence_key" ON "orders_v4_inventory_ledger"("sequence");

-- CreateIndex
CREATE INDEX "orders_v4_inventory_ledger_tenant_id_idx" ON "orders_v4_inventory_ledger"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_inventory_ledger_company_id_item_id_location_id_s_idx" ON "orders_v4_inventory_ledger"("company_id", "item_id", "location_id", "sequence");

-- CreateIndex
CREATE INDEX "orders_v4_inventory_ledger_company_id_effective_at_idx" ON "orders_v4_inventory_ledger"("company_id", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_inventory_ledger_company_id_source_key_key" ON "orders_v4_inventory_ledger"("company_id", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_inventory_ledger_reversal_of_id_key" ON "orders_v4_inventory_ledger"("reversal_of_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_custody_ledger_sequence_key" ON "orders_v4_custody_ledger"("sequence");

-- CreateIndex
CREATE INDEX "orders_v4_custody_ledger_tenant_id_idx" ON "orders_v4_custody_ledger"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_custody_ledger_company_id_sequence_idx" ON "orders_v4_custody_ledger"("company_id", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_custody_ledger_company_id_source_key_key" ON "orders_v4_custody_ledger"("company_id", "source_key");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_custody_ledger_reversal_of_id_key" ON "orders_v4_custody_ledger"("reversal_of_id");

-- CreateIndex
CREATE INDEX "orders_v4_stocktakes_tenant_id_idx" ON "orders_v4_stocktakes"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_stocktakes_company_id_stocktake_date_idx" ON "orders_v4_stocktakes"("company_id", "stocktake_date");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_stocktakes_company_id_stocktake_number_key" ON "orders_v4_stocktakes"("company_id", "stocktake_number");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_stocktakes_company_id_idempotency_key_key" ON "orders_v4_stocktakes"("company_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "orders_v4_stocktake_lines_tenant_id_idx" ON "orders_v4_stocktake_lines"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_stocktake_lines_company_id_item_id_idx" ON "orders_v4_stocktake_lines"("company_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_stocktake_lines_stocktake_id_item_id_key" ON "orders_v4_stocktake_lines"("stocktake_id", "item_id");

-- CreateIndex
CREATE INDEX "orders_v4_migration_map_tenant_id_idx" ON "orders_v4_migration_map"("tenant_id");

-- CreateIndex
CREATE INDEX "orders_v4_migration_map_company_id_migration_run_id_status_idx" ON "orders_v4_migration_map"("company_id", "migration_run_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "orders_v4_migration_map_company_id_source_system_source_ent_key" ON "orders_v4_migration_map"("company_id", "source_system", "source_entity", "source_id");

-- AddForeignKey
ALTER TABLE "orders_v4_items" ADD CONSTRAINT "orders_v4_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "orders_v4_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_items" ADD CONSTRAINT "orders_v4_items_inventory_unit_id_fkey" FOREIGN KEY ("inventory_unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_item_units" ADD CONSTRAINT "orders_v4_item_units_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "orders_v4_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_item_units" ADD CONSTRAINT "orders_v4_item_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_item_sections" ADD CONSTRAINT "orders_v4_item_sections_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "orders_v4_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_item_sections" ADD CONSTRAINT "orders_v4_item_sections_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "orders_v4_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_conversion_versions" ADD CONSTRAINT "orders_v4_conversion_versions_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "orders_v4_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_conversion_edges" ADD CONSTRAINT "orders_v4_conversion_edges_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "orders_v4_conversion_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_conversion_edges" ADD CONSTRAINT "orders_v4_conversion_edges_from_unit_id_fkey" FOREIGN KEY ("from_unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_conversion_edges" ADD CONSTRAINT "orders_v4_conversion_edges_to_unit_id_fkey" FOREIGN KEY ("to_unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_recipe_versions" ADD CONSTRAINT "orders_v4_recipe_versions_output_item_id_fkey" FOREIGN KEY ("output_item_id") REFERENCES "orders_v4_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_recipe_versions" ADD CONSTRAINT "orders_v4_recipe_versions_output_unit_id_fkey" FOREIGN KEY ("output_unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_recipe_lines" ADD CONSTRAINT "orders_v4_recipe_lines_recipe_version_id_fkey" FOREIGN KEY ("recipe_version_id") REFERENCES "orders_v4_recipe_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_recipe_lines" ADD CONSTRAINT "orders_v4_recipe_lines_component_item_id_fkey" FOREIGN KEY ("component_item_id") REFERENCES "orders_v4_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_recipe_lines" ADD CONSTRAINT "orders_v4_recipe_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_locations" ADD CONSTRAINT "orders_v4_locations_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "orders_v4_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_documents" ADD CONSTRAINT "orders_v4_documents_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "orders_v4_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_documents" ADD CONSTRAINT "orders_v4_documents_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "orders_v4_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_documents" ADD CONSTRAINT "orders_v4_documents_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "orders_v4_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_document_lines" ADD CONSTRAINT "orders_v4_document_lines_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "orders_v4_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_document_lines" ADD CONSTRAINT "orders_v4_document_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "orders_v4_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_document_lines" ADD CONSTRAINT "orders_v4_document_lines_input_unit_id_fkey" FOREIGN KEY ("input_unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_document_lines" ADD CONSTRAINT "orders_v4_document_lines_price_unit_id_fkey" FOREIGN KEY ("price_unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_document_lines" ADD CONSTRAINT "orders_v4_document_lines_conversion_version_id_fkey" FOREIGN KEY ("conversion_version_id") REFERENCES "orders_v4_conversion_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_document_lines" ADD CONSTRAINT "orders_v4_document_lines_recipe_version_id_fkey" FOREIGN KEY ("recipe_version_id") REFERENCES "orders_v4_recipe_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_price_history" ADD CONSTRAINT "orders_v4_price_history_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "orders_v4_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_price_history" ADD CONSTRAINT "orders_v4_price_history_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_price_history" ADD CONSTRAINT "orders_v4_price_history_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "orders_v4_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_price_history" ADD CONSTRAINT "orders_v4_price_history_document_line_id_fkey" FOREIGN KEY ("document_line_id") REFERENCES "orders_v4_document_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_price_history" ADD CONSTRAINT "orders_v4_price_history_conversion_version_id_fkey" FOREIGN KEY ("conversion_version_id") REFERENCES "orders_v4_conversion_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_inventory_ledger" ADD CONSTRAINT "orders_v4_inventory_ledger_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "orders_v4_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_inventory_ledger" ADD CONSTRAINT "orders_v4_inventory_ledger_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "orders_v4_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_inventory_ledger" ADD CONSTRAINT "orders_v4_inventory_ledger_document_line_id_fkey" FOREIGN KEY ("document_line_id") REFERENCES "orders_v4_document_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_inventory_ledger" ADD CONSTRAINT "orders_v4_inventory_ledger_conversion_version_id_fkey" FOREIGN KEY ("conversion_version_id") REFERENCES "orders_v4_conversion_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_inventory_ledger" ADD CONSTRAINT "orders_v4_inventory_ledger_recipe_version_id_fkey" FOREIGN KEY ("recipe_version_id") REFERENCES "orders_v4_recipe_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_inventory_ledger" ADD CONSTRAINT "orders_v4_inventory_ledger_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "orders_v4_inventory_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_custody_ledger" ADD CONSTRAINT "orders_v4_custody_ledger_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "orders_v4_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_custody_ledger" ADD CONSTRAINT "orders_v4_custody_ledger_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "orders_v4_custody_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_stocktakes" ADD CONSTRAINT "orders_v4_stocktakes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "orders_v4_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_stocktake_lines" ADD CONSTRAINT "orders_v4_stocktake_lines_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "orders_v4_stocktakes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_stocktake_lines" ADD CONSTRAINT "orders_v4_stocktake_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "orders_v4_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders_v4_stocktake_lines" ADD CONSTRAINT "orders_v4_stocktake_lines_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "orders_v4_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints are intentionally database-owned as well as API-owned.
ALTER TABLE "orders_v4_units" ADD CONSTRAINT "orders_v4_units_factor_check" CHECK ("canonical_factor" IS NULL OR "canonical_factor" > 0);
ALTER TABLE "orders_v4_units" ADD CONSTRAINT "orders_v4_units_scale_check" CHECK ("decimal_scale" BETWEEN 0 AND 8);
ALTER TABLE "orders_v4_items" ADD CONSTRAINT "orders_v4_items_type_check" CHECK ("item_type" IN ('purchased', 'sale'));
ALTER TABLE "orders_v4_item_units" ADD CONSTRAINT "orders_v4_item_units_price_check" CHECK ("last_price" IS NULL OR "last_price" >= 0);
ALTER TABLE "orders_v4_conversion_versions" ADD CONSTRAINT "orders_v4_conversion_version_check" CHECK ("version" > 0 AND "status" IN ('draft', 'published', 'retired'));
ALTER TABLE "orders_v4_conversion_edges" ADD CONSTRAINT "orders_v4_conversion_factor_check" CHECK ("factor" > 0 AND "from_unit_id" <> "to_unit_id");
ALTER TABLE "orders_v4_recipe_versions" ADD CONSTRAINT "orders_v4_recipe_output_check" CHECK ("output_quantity" > 0 AND "version" > 0 AND "status" IN ('draft', 'published', 'retired'));
ALTER TABLE "orders_v4_recipe_lines" ADD CONSTRAINT "orders_v4_recipe_line_quantity_check" CHECK ("quantity" > 0);
ALTER TABLE "orders_v4_locations" ADD CONSTRAINT "orders_v4_location_kind_check" CHECK ("kind" IN ('warehouse', 'section', 'virtual'));
ALTER TABLE "orders_v4_documents" ADD CONSTRAINT "orders_v4_document_type_check" CHECK ("document_type" IN ('purchase', 'registration'));
ALTER TABLE "orders_v4_documents" ADD CONSTRAINT "orders_v4_document_status_check" CHECK ("status" IN ('prepared', 'received', 'cancelled', 'reversed'));
ALTER TABLE "orders_v4_documents" ADD CONSTRAINT "orders_v4_payment_check" CHECK ("payment_method" IS NULL OR "payment_method" IN ('custody', 'cash', 'transfer'));
ALTER TABLE "orders_v4_documents" ADD CONSTRAINT "orders_v4_document_amount_check" CHECK ("status" = 'reversed' OR ("subtotal" >= 0 AND "total_amount" >= 0 AND ("petty_cash_amount" IS NULL OR "petty_cash_amount" >= 0)));
ALTER TABLE "orders_v4_document_lines" ADD CONSTRAINT "orders_v4_document_line_quantity_check" CHECK ("input_quantity" > 0 AND "base_quantity" > 0 AND "price_quantity" > 0);
ALTER TABLE "orders_v4_document_lines" ADD CONSTRAINT "orders_v4_document_line_price_check" CHECK ("unit_price" >= 0 AND "line_total" >= 0);
ALTER TABLE "orders_v4_price_history" ADD CONSTRAINT "orders_v4_price_history_price_check" CHECK ("unit_price" >= 0 AND "inventory_unit_price" >= 0);
ALTER TABLE "orders_v4_inventory_ledger" ADD CONSTRAINT "orders_v4_inventory_entry_type_check" CHECK ("entry_type" IN ('receipt', 'issue', 'transfer_in', 'transfer_out', 'stocktake_adjustment', 'reversal'));
ALTER TABLE "orders_v4_inventory_ledger" ADD CONSTRAINT "orders_v4_inventory_cost_check" CHECK ("unit_cost" >= 0 AND "average_unit_cost_after" >= 0);
ALTER TABLE "orders_v4_custody_ledger" ADD CONSTRAINT "orders_v4_custody_entry_type_check" CHECK ("entry_type" IN ('funding', 'purchase', 'adjustment', 'reversal'));
ALTER TABLE "orders_v4_stocktakes" ADD CONSTRAINT "orders_v4_stocktake_status_check" CHECK ("status" IN ('posted', 'reversed'));
ALTER TABLE "orders_v4_stocktake_lines" ADD CONSTRAINT "orders_v4_stocktake_physical_check" CHECK ("physical_quantity" >= 0);
ALTER TABLE "orders_v4_migration_map" ADD CONSTRAINT "orders_v4_migration_status_check" CHECK ("status" IN ('pending', 'migrated', 'verified', 'failed'));

CREATE OR REPLACE FUNCTION orders_v4_validate_scope() RETURNS trigger AS $$
DECLARE parent_tenant TEXT;
BEGIN
  IF NEW."company_id" IS NULL OR NEW."tenant_id" IS NULL THEN
    RAISE EXCEPTION 'Orders V4 scope is required';
  END IF;
  SELECT "tenant_id" INTO parent_tenant FROM "companies" WHERE "id" = NEW."company_id";
  IF parent_tenant IS DISTINCT FROM NEW."tenant_id" THEN
    RAISE EXCEPTION 'Orders V4 tenant/company scope mismatch';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION orders_v4_reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Orders V4 audit rows are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_v4_inventory_ledger_immutable BEFORE UPDATE OR DELETE ON "orders_v4_inventory_ledger"
  FOR EACH ROW EXECUTE FUNCTION orders_v4_reject_mutation();
CREATE TRIGGER orders_v4_custody_ledger_immutable BEFORE UPDATE OR DELETE ON "orders_v4_custody_ledger"
  FOR EACH ROW EXECUTE FUNCTION orders_v4_reject_mutation();
CREATE TRIGGER orders_v4_price_history_immutable BEFORE UPDATE OR DELETE ON "orders_v4_price_history"
  FOR EACH ROW EXECUTE FUNCTION orders_v4_reject_mutation();

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'orders_v4_units', 'orders_v4_categories', 'orders_v4_sections', 'orders_v4_items',
    'orders_v4_item_units', 'orders_v4_item_sections', 'orders_v4_conversion_versions',
    'orders_v4_conversion_edges', 'orders_v4_recipe_versions', 'orders_v4_recipe_lines',
    'orders_v4_locations', 'orders_v4_documents', 'orders_v4_document_lines',
    'orders_v4_price_history', 'orders_v4_inventory_ledger', 'orders_v4_custody_ledger',
    'orders_v4_stocktakes', 'orders_v4_stocktake_lines', 'orders_v4_migration_map'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I_scope BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION orders_v4_validate_scope()', table_name, table_name);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('CREATE POLICY %I_tenant_select ON %I FOR SELECT USING (tenant_id = current_tenant_id())', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_tenant_insert ON %I FOR INSERT WITH CHECK (tenant_id = current_tenant_id())', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_tenant_update ON %I FOR UPDATE USING (tenant_id = current_tenant_id()) WITH CHECK (tenant_id = current_tenant_id())', table_name, table_name);
    EXECUTE format('CREATE POLICY %I_tenant_delete ON %I FOR DELETE USING (tenant_id = current_tenant_id())', table_name, table_name);
  END LOOP;
END $$;

CREATE TABLE "inventory_locations_v2" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name_ar" TEXT NOT NULL,
  "name_en" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'warehouse',
  "order_section_id" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "inventory_locations_v2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_locations_v2_kind_check"
    CHECK ("kind" IN ('warehouse', 'section', 'virtual'))
);

CREATE TABLE "inventory_definition_versions_v2" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "base_unit" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "content_hash" TEXT NOT NULL,
  "provenance" TEXT NOT NULL DEFAULT 'catalog',
  "status" TEXT NOT NULL DEFAULT 'published',
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_definition_versions_v2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_definition_versions_v2_kind_check"
    CHECK ("kind" IN ('conversion', 'recipe')),
  CONSTRAINT "inventory_definition_versions_v2_status_check"
    CHECK ("status" IN ('published', 'retired')),
  CONSTRAINT "inventory_definition_versions_v2_version_check"
    CHECK ("version" > 0 AND "schema_version" > 0),
  CONSTRAINT "inventory_definition_versions_v2_base_unit_check"
    CHECK (length(trim("base_unit")) > 0)
);

CREATE TABLE "inventory_ledger_entries_v2" (
  "id" TEXT NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "effective_at" TIMESTAMP(3) NOT NULL,
  "entry_type" TEXT NOT NULL,
  "quantity_delta" DECIMAL(18,6) NOT NULL,
  "unit_cost" DECIMAL(18,6) NOT NULL,
  "value_delta" DECIMAL(18,6) NOT NULL,
  "quantity_after" DECIMAL(18,6) NOT NULL,
  "value_after" DECIMAL(18,6) NOT NULL,
  "average_unit_cost_after" DECIMAL(18,6) NOT NULL,
  "source_key" TEXT NOT NULL,
  "source_hash" TEXT NOT NULL,
  "source_type" TEXT NOT NULL,
  "source_snapshot" JSONB NOT NULL,
  "pair_key" TEXT,
  "reversal_of_id" TEXT,
  "conversion_version_id" TEXT,
  "recipe_version_id" TEXT,
  "created_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_ledger_entries_v2_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "inventory_ledger_entries_v2_entry_type_check"
    CHECK ("entry_type" IN ('opening_balance', 'receipt', 'issue', 'stocktake_adjustment', 'reversal')),
  CONSTRAINT "inventory_ledger_entries_v2_quantity_check"
    CHECK ("quantity_delta" <> 0),
  CONSTRAINT "inventory_ledger_entries_v2_cost_check"
    CHECK ("unit_cost" >= 0 AND "average_unit_cost_after" >= 0)
);

ALTER TABLE "order_items"
  ADD COLUMN "inventory_conversion_version_id_v2" TEXT;

ALTER TABLE "staff_order_items"
  ADD COLUMN "inventory_recipe_version_id_v2" TEXT;

CREATE UNIQUE INDEX "inventory_locations_v2_company_id_code_key"
  ON "inventory_locations_v2"("company_id", "code");
CREATE INDEX "inventory_locations_v2_tenant_id_idx"
  ON "inventory_locations_v2"("tenant_id");
CREATE INDEX "inventory_locations_v2_company_id_is_active_idx"
  ON "inventory_locations_v2"("company_id", "is_active");
CREATE INDEX "inventory_locations_v2_order_section_id_idx"
  ON "inventory_locations_v2"("order_section_id");

CREATE UNIQUE INDEX "inventory_definition_versions_v2_product_kind_version_key"
  ON "inventory_definition_versions_v2"("product_id", "kind", "version");
CREATE UNIQUE INDEX "inventory_definition_versions_v2_product_kind_hash_key"
  ON "inventory_definition_versions_v2"("product_id", "kind", "content_hash");
CREATE INDEX "inventory_definition_versions_v2_tenant_id_idx"
  ON "inventory_definition_versions_v2"("tenant_id");
CREATE INDEX "inventory_definition_versions_v2_company_product_kind_status_idx"
  ON "inventory_definition_versions_v2"("company_id", "product_id", "kind", "status");

CREATE UNIQUE INDEX "inventory_ledger_entries_v2_sequence_key"
  ON "inventory_ledger_entries_v2"("sequence");
CREATE UNIQUE INDEX "inventory_ledger_entries_v2_company_source_key"
  ON "inventory_ledger_entries_v2"("company_id", "source_key");
CREATE UNIQUE INDEX "inventory_ledger_entries_v2_single_reversal_key"
  ON "inventory_ledger_entries_v2"("reversal_of_id")
  WHERE "reversal_of_id" IS NOT NULL;
CREATE INDEX "inventory_ledger_entries_v2_tenant_id_idx"
  ON "inventory_ledger_entries_v2"("tenant_id");
CREATE INDEX "inventory_ledger_entries_v2_company_product_location_sequence_idx"
  ON "inventory_ledger_entries_v2"("company_id", "product_id", "location_id", "sequence");
CREATE INDEX "inventory_ledger_entries_v2_company_effective_at_idx"
  ON "inventory_ledger_entries_v2"("company_id", "effective_at");
CREATE INDEX "inventory_ledger_entries_v2_pair_key_idx"
  ON "inventory_ledger_entries_v2"("pair_key");
CREATE INDEX "inventory_ledger_entries_v2_reversal_of_id_idx"
  ON "inventory_ledger_entries_v2"("reversal_of_id");

CREATE INDEX "order_items_inventory_conversion_version_v2_idx"
  ON "order_items"("inventory_conversion_version_id_v2");
CREATE INDEX "staff_order_items_inventory_recipe_version_v2_idx"
  ON "staff_order_items"("inventory_recipe_version_id_v2");

ALTER TABLE "inventory_locations_v2"
  ADD CONSTRAINT "inventory_locations_v2_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_locations_v2"
  ADD CONSTRAINT "inventory_locations_v2_order_section_id_fkey"
  FOREIGN KEY ("order_section_id") REFERENCES "order_sections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_definition_versions_v2"
  ADD CONSTRAINT "inventory_definition_versions_v2_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_definition_versions_v2"
  ADD CONSTRAINT "inventory_definition_versions_v2_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "order_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_definition_versions_v2"
  ADD CONSTRAINT "inventory_definition_versions_v2_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_ledger_entries_v2"
  ADD CONSTRAINT "inventory_ledger_entries_v2_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_ledger_entries_v2"
  ADD CONSTRAINT "inventory_ledger_entries_v2_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "order_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_ledger_entries_v2"
  ADD CONSTRAINT "inventory_ledger_entries_v2_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "inventory_locations_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_ledger_entries_v2"
  ADD CONSTRAINT "inventory_ledger_entries_v2_reversal_of_id_fkey"
  FOREIGN KEY ("reversal_of_id") REFERENCES "inventory_ledger_entries_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_ledger_entries_v2"
  ADD CONSTRAINT "inventory_ledger_entries_v2_conversion_version_id_fkey"
  FOREIGN KEY ("conversion_version_id") REFERENCES "inventory_definition_versions_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_ledger_entries_v2"
  ADD CONSTRAINT "inventory_ledger_entries_v2_recipe_version_id_fkey"
  FOREIGN KEY ("recipe_version_id") REFERENCES "inventory_definition_versions_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_ledger_entries_v2"
  ADD CONSTRAINT "inventory_ledger_entries_v2_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_inventory_conversion_version_v2_fkey"
  FOREIGN KEY ("inventory_conversion_version_id_v2") REFERENCES "inventory_definition_versions_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "staff_order_items"
  ADD CONSTRAINT "staff_order_items_inventory_recipe_version_v2_fkey"
  FOREIGN KEY ("inventory_recipe_version_id_v2") REFERENCES "inventory_definition_versions_v2"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION validate_inventory_v2_scope() RETURNS trigger AS $$
DECLARE
  product_tenant TEXT;
  product_company TEXT;
  location_tenant TEXT;
  location_company TEXT;
  definition_tenant TEXT;
  definition_company TEXT;
  definition_product TEXT;
  definition_kind TEXT;
BEGIN
  SELECT "tenant_id", "company_id" INTO product_tenant, product_company
  FROM "order_products" WHERE "id" = NEW."product_id";

  IF product_tenant IS DISTINCT FROM NEW."tenant_id"
     OR product_company IS DISTINCT FROM NEW."company_id" THEN
    RAISE EXCEPTION 'Inventory V2 product scope mismatch';
  END IF;

  IF TG_TABLE_NAME = 'inventory_ledger_entries_v2' THEN
    SELECT "tenant_id", "company_id" INTO location_tenant, location_company
    FROM "inventory_locations_v2" WHERE "id" = NEW."location_id";

    IF location_tenant IS DISTINCT FROM NEW."tenant_id"
       OR location_company IS DISTINCT FROM NEW."company_id" THEN
      RAISE EXCEPTION 'Inventory V2 location scope mismatch';
    END IF;

    IF NEW."conversion_version_id" IS NOT NULL THEN
      SELECT "tenant_id", "company_id", "product_id", "kind"
      INTO definition_tenant, definition_company, definition_product, definition_kind
      FROM "inventory_definition_versions_v2" WHERE "id" = NEW."conversion_version_id";

      IF definition_tenant IS DISTINCT FROM NEW."tenant_id"
         OR definition_company IS DISTINCT FROM NEW."company_id"
         OR definition_product IS DISTINCT FROM NEW."product_id"
         OR definition_kind IS DISTINCT FROM 'conversion' THEN
        RAISE EXCEPTION 'Inventory V2 conversion version scope mismatch';
      END IF;
    END IF;

    IF NEW."recipe_version_id" IS NOT NULL THEN
      SELECT "tenant_id", "company_id", "kind"
      INTO definition_tenant, definition_company, definition_kind
      FROM "inventory_definition_versions_v2" WHERE "id" = NEW."recipe_version_id";

      IF definition_tenant IS DISTINCT FROM NEW."tenant_id"
         OR definition_company IS DISTINCT FROM NEW."company_id"
         OR definition_kind IS DISTINCT FROM 'recipe' THEN
        RAISE EXCEPTION 'Inventory V2 recipe version scope mismatch';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_definition_versions_v2_scope
  BEFORE INSERT ON "inventory_definition_versions_v2"
  FOR EACH ROW EXECUTE FUNCTION validate_inventory_v2_scope();
CREATE TRIGGER inventory_ledger_entries_v2_scope
  BEFORE INSERT ON "inventory_ledger_entries_v2"
  FOR EACH ROW EXECUTE FUNCTION validate_inventory_v2_scope();

CREATE TRIGGER inventory_definition_versions_v2_immutable
  BEFORE UPDATE OR DELETE ON "inventory_definition_versions_v2"
  FOR EACH ROW EXECUTE FUNCTION reject_inventory_audit_mutation();
CREATE TRIGGER inventory_ledger_entries_v2_immutable
  BEFORE UPDATE OR DELETE ON "inventory_ledger_entries_v2"
  FOR EACH ROW EXECUTE FUNCTION reject_inventory_audit_mutation();

ALTER TABLE "inventory_locations_v2" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_definition_versions_v2" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_ledger_entries_v2" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory_locations_v2_tenant_select" ON "inventory_locations_v2"
  FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "inventory_locations_v2_tenant_modify" ON "inventory_locations_v2"
  FOR ALL USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "inventory_definition_versions_v2_tenant_select" ON "inventory_definition_versions_v2"
  FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "inventory_definition_versions_v2_tenant_insert" ON "inventory_definition_versions_v2"
  FOR INSERT WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "inventory_ledger_entries_v2_tenant_select" ON "inventory_ledger_entries_v2"
  FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "inventory_ledger_entries_v2_tenant_insert" ON "inventory_ledger_entries_v2"
  FOR INSERT WITH CHECK ("tenant_id" = current_tenant_id());

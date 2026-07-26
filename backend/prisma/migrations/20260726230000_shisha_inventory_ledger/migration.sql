CREATE TABLE "shisha_inventory_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "tracking_started_at" DATE NOT NULL,
    "heads_per_kg" DECIMAL(10,4) NOT NULL DEFAULT 39,
    "charcoal_packs_per_carton" INTEGER NOT NULL DEFAULT 10,
    "charcoal_pieces_per_pack" INTEGER NOT NULL DEFAULT 64,
    "shisha_section_id" TEXT,
    "change_product_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shisha_inventory_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shisha_stocktakes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "stocktake_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "expected_tobacco_grams" DECIMAL(18,6) NOT NULL,
    "physical_tobacco_grams" DECIMAL(18,6) NOT NULL,
    "tobacco_variance_grams" DECIMAL(18,6) NOT NULL,
    "expected_hoses" DECIMAL(18,6) NOT NULL,
    "physical_hoses" DECIMAL(18,6) NOT NULL,
    "hose_variance" DECIMAL(18,6) NOT NULL,
    "expected_charcoal_pieces" DECIMAL(18,6) NOT NULL,
    "physical_charcoal_pieces" DECIMAL(18,6) NOT NULL,
    "charcoal_variance_pieces" DECIMAL(18,6) NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shisha_stocktakes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shisha_inventory_movements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "transaction_date" DATE NOT NULL,
    "movement_type" TEXT NOT NULL,
    "material_type" TEXT NOT NULL,
    "quantity_base" DECIMAL(18,6) NOT NULL,
    "cost_incl_vat" DECIMAL(18,4),
    "invoice_number" TEXT,
    "supplier_name" TEXT,
    "source_key" TEXT,
    "stocktake_id" TEXT,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "shisha_inventory_movements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shisha_inventory_settings_company_id_key"
ON "shisha_inventory_settings"("company_id");
CREATE INDEX "shisha_inventory_settings_tenant_id_idx"
ON "shisha_inventory_settings"("tenant_id");

CREATE UNIQUE INDEX "shisha_stocktakes_company_id_stocktake_date_key"
ON "shisha_stocktakes"("company_id", "stocktake_date");
CREATE INDEX "shisha_stocktakes_tenant_id_idx"
ON "shisha_stocktakes"("tenant_id");
CREATE INDEX "shisha_stocktakes_company_id_stocktake_date_idx"
ON "shisha_stocktakes"("company_id", "stocktake_date");

CREATE UNIQUE INDEX "shisha_inventory_movements_source_key_key"
ON "shisha_inventory_movements"("source_key");
CREATE INDEX "shisha_inventory_movements_tenant_id_idx"
ON "shisha_inventory_movements"("tenant_id");
CREATE INDEX "shisha_inventory_movements_company_id_transaction_date_idx"
ON "shisha_inventory_movements"("company_id", "transaction_date");
CREATE INDEX "shisha_inventory_movements_company_id_material_type_transaction_date_idx"
ON "shisha_inventory_movements"("company_id", "material_type", "transaction_date");
CREATE INDEX "shisha_inventory_movements_stocktake_id_idx"
ON "shisha_inventory_movements"("stocktake_id");

ALTER TABLE "shisha_inventory_settings"
ADD CONSTRAINT "shisha_inventory_settings_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shisha_stocktakes"
ADD CONSTRAINT "shisha_stocktakes_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shisha_stocktakes"
ADD CONSTRAINT "shisha_stocktakes_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shisha_inventory_movements"
ADD CONSTRAINT "shisha_inventory_movements_company_id_fkey"
FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shisha_inventory_movements"
ADD CONSTRAINT "shisha_inventory_movements_stocktake_id_fkey"
FOREIGN KEY ("stocktake_id") REFERENCES "shisha_stocktakes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "shisha_inventory_movements"
ADD CONSTRAINT "shisha_inventory_movements_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "shisha_inventory_movements"
ADD CONSTRAINT "shisha_inventory_movements_type_check"
CHECK ("movement_type" IN ('opening', 'purchase', 'stocktake_adjustment'));

ALTER TABLE "shisha_inventory_movements"
ADD CONSTRAINT "shisha_inventory_movements_material_check"
CHECK ("material_type" IN ('tobacco', 'hose', 'charcoal'));

ALTER TABLE "shisha_inventory_movements"
ADD CONSTRAINT "shisha_inventory_movements_quantity_check"
CHECK ("movement_type" = 'stocktake_adjustment' OR "quantity_base" >= 0);

ALTER TABLE "shisha_stocktakes"
ADD CONSTRAINT "shisha_stocktakes_status_check"
CHECK ("status" = 'approved');

-- Every tenant-owned table uses the same request-scoped PostgreSQL tenant id.
ALTER TABLE "shisha_inventory_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shisha_inventory_settings" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_select" ON "shisha_inventory_settings"
  FOR SELECT TO PUBLIC USING ("tenant_id" = current_tenant_id());
CREATE POLICY "tenant_isolation_modify" ON "shisha_inventory_settings"
  FOR ALL TO PUBLIC
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "shisha_inventory_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shisha_inventory_movements" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_select" ON "shisha_inventory_movements"
  FOR SELECT TO PUBLIC USING ("tenant_id" = current_tenant_id());
CREATE POLICY "tenant_isolation_modify" ON "shisha_inventory_movements"
  FOR ALL TO PUBLIC
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

ALTER TABLE "shisha_stocktakes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shisha_stocktakes" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_select" ON "shisha_stocktakes"
  FOR SELECT TO PUBLIC USING ("tenant_id" = current_tenant_id());
CREATE POLICY "tenant_isolation_modify" ON "shisha_stocktakes"
  FOR ALL TO PUBLIC
  USING ("tenant_id" = current_tenant_id())
  WITH CHECK ("tenant_id" = current_tenant_id());

-- Ledger and approved stocktakes are append-only, including for direct SQL users.
CREATE OR REPLACE FUNCTION "reject_shisha_inventory_history_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Shisha inventory history is immutable; append a stocktake adjustment instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "shisha_inventory_movements_immutable"
BEFORE UPDATE OR DELETE ON "shisha_inventory_movements"
FOR EACH ROW EXECUTE FUNCTION "reject_shisha_inventory_history_mutation"();

CREATE TRIGGER "shisha_stocktakes_immutable"
BEFORE UPDATE OR DELETE ON "shisha_stocktakes"
FOR EACH ROW EXECUTE FUNCTION "reject_shisha_inventory_history_mutation"();

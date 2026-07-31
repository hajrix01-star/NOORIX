CREATE TABLE "inventory_stocktakes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "stocktake_date" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_stocktakes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_stocktakes_status_check" CHECK ("status" = 'approved')
);

CREATE TABLE "inventory_stocktake_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "stocktake_id" TEXT NOT NULL,
    "stocktake_date" DATE NOT NULL,
    "product_id" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "expected_quantity" DECIMAL(18,6) NOT NULL,
    "physical_quantity" DECIMAL(18,6) NOT NULL,
    "variance_quantity" DECIMAL(18,6) NOT NULL,
    CONSTRAINT "inventory_stocktake_lines_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_stocktake_lines_physical_nonnegative_check" CHECK ("physical_quantity" >= 0),
    CONSTRAINT "inventory_stocktake_lines_variance_check" CHECK ("variance_quantity" = "physical_quantity" - "expected_quantity")
);

CREATE TABLE "inventory_movements" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "transaction_date" DATE NOT NULL,
    "movement_type" TEXT NOT NULL,
    "quantity_base" DECIMAL(18,6) NOT NULL,
    "stocktake_id" TEXT,
    "source_key" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_movements_type_check" CHECK ("movement_type" = 'stocktake_adjustment'),
    CONSTRAINT "inventory_movements_stocktake_required_check" CHECK ("stocktake_id" IS NOT NULL)
);

CREATE INDEX "inventory_stocktakes_tenant_id_idx" ON "inventory_stocktakes"("tenant_id");
CREATE INDEX "inventory_stocktakes_company_id_stocktake_date_idx" ON "inventory_stocktakes"("company_id", "stocktake_date");
CREATE UNIQUE INDEX "inventory_stocktakes_company_id_id_key" ON "inventory_stocktakes"("company_id", "id");
CREATE UNIQUE INDEX "inventory_stocktakes_company_id_id_stocktake_date_key" ON "inventory_stocktakes"("company_id", "id", "stocktake_date");
CREATE UNIQUE INDEX "order_products_company_id_id_key" ON "order_products"("company_id", "id");
CREATE UNIQUE INDEX "inventory_stocktake_lines_stocktake_id_product_id_key" ON "inventory_stocktake_lines"("stocktake_id", "product_id");
CREATE UNIQUE INDEX "inventory_stocktake_lines_company_id_product_id_stocktake_date_key" ON "inventory_stocktake_lines"("company_id", "product_id", "stocktake_date");
CREATE INDEX "inventory_stocktake_lines_tenant_id_idx" ON "inventory_stocktake_lines"("tenant_id");
CREATE INDEX "inventory_stocktake_lines_company_id_product_id_idx" ON "inventory_stocktake_lines"("company_id", "product_id");
CREATE UNIQUE INDEX "inventory_movements_source_key_key" ON "inventory_movements"("source_key");
CREATE INDEX "inventory_movements_tenant_id_idx" ON "inventory_movements"("tenant_id");
CREATE INDEX "inventory_movements_company_id_product_id_transaction_date_idx" ON "inventory_movements"("company_id", "product_id", "transaction_date");
CREATE INDEX "inventory_movements_stocktake_id_idx" ON "inventory_movements"("stocktake_id");

ALTER TABLE "inventory_stocktakes" ADD CONSTRAINT "inventory_stocktakes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktakes" ADD CONSTRAINT "inventory_stocktakes_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktake_lines" ADD CONSTRAINT "inventory_stocktake_lines_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktake_lines" ADD CONSTRAINT "inventory_stocktake_lines_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "inventory_stocktakes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktake_lines" ADD CONSTRAINT "inventory_stocktake_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "order_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktake_lines" ADD CONSTRAINT "inventory_stocktake_lines_company_stocktake_fkey" FOREIGN KEY ("company_id", "stocktake_id") REFERENCES "inventory_stocktakes"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktake_lines" ADD CONSTRAINT "inventory_stocktake_lines_company_stocktake_date_fkey" FOREIGN KEY ("company_id", "stocktake_id", "stocktake_date") REFERENCES "inventory_stocktakes"("company_id", "id", "stocktake_date") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_stocktake_lines" ADD CONSTRAINT "inventory_stocktake_lines_company_product_fkey" FOREIGN KEY ("company_id", "product_id") REFERENCES "order_products"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "order_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_stocktake_id_fkey" FOREIGN KEY ("stocktake_id") REFERENCES "inventory_stocktakes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_company_stocktake_fkey" FOREIGN KEY ("company_id", "stocktake_id") REFERENCES "inventory_stocktakes"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_company_product_fkey" FOREIGN KEY ("company_id", "product_id") REFERENCES "order_products"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "inventory_stocktakes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_stocktakes" FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_stocktake_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_stocktake_lines" FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_movements" FORCE ROW LEVEL SECURITY;

CREATE POLICY "inventory_stocktakes_tenant_select" ON "inventory_stocktakes" FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "inventory_stocktakes_tenant_modify" ON "inventory_stocktakes" FOR ALL USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "inventory_stocktake_lines_tenant_select" ON "inventory_stocktake_lines" FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "inventory_stocktake_lines_tenant_modify" ON "inventory_stocktake_lines" FOR ALL USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());
CREATE POLICY "inventory_movements_tenant_select" ON "inventory_movements" FOR SELECT USING ("tenant_id" = current_tenant_id());
CREATE POLICY "inventory_movements_tenant_modify" ON "inventory_movements" FOR ALL USING ("tenant_id" = current_tenant_id()) WITH CHECK ("tenant_id" = current_tenant_id());

CREATE OR REPLACE FUNCTION reject_inventory_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Inventory audit records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_stocktakes_immutable BEFORE UPDATE OR DELETE ON "inventory_stocktakes" FOR EACH ROW EXECUTE FUNCTION reject_inventory_audit_mutation();
CREATE TRIGGER inventory_stocktake_lines_immutable BEFORE UPDATE OR DELETE ON "inventory_stocktake_lines" FOR EACH ROW EXECUTE FUNCTION reject_inventory_audit_mutation();
CREATE TRIGGER inventory_movements_immutable BEFORE UPDATE OR DELETE ON "inventory_movements" FOR EACH ROW EXECUTE FUNCTION reject_inventory_audit_mutation();

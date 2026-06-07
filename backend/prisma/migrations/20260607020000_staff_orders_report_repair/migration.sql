-- Repair staff order report data shape and tenant isolation.
-- Older deployments added unit_price as nullable while Prisma expects a non-null Decimal.
-- Reading those rows through Prisma can fail with a generic database error.

ALTER TABLE "staff_order_items" ADD COLUMN IF NOT EXISTS "unit_price" DECIMAL(18,4);
UPDATE "staff_order_items" SET "unit_price" = 0 WHERE "unit_price" IS NULL;
ALTER TABLE "staff_order_items" ALTER COLUMN "unit_price" SET DEFAULT 0;
ALTER TABLE "staff_order_items" ALTER COLUMN "unit_price" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "staff_orders_company_type_created_idx"
  ON "staff_orders"("company_id", "order_type", "created_at");
CREATE INDEX IF NOT EXISTS "staff_orders_company_type_sale_date_idx"
  ON "staff_orders"("company_id", "order_type", "sale_date");

CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')
$$;

-- Staff Orders
ALTER TABLE staff_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_orders FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON staff_orders;
DROP POLICY IF EXISTS tenant_isolation_modify ON staff_orders;
CREATE POLICY tenant_isolation_select ON staff_orders
  FOR SELECT TO PUBLIC
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_modify ON staff_orders
  FOR ALL TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Staff Order Items inherit tenant isolation from staff_orders.
ALTER TABLE staff_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_order_items FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_select ON staff_order_items;
DROP POLICY IF EXISTS tenant_isolation_modify ON staff_order_items;
CREATE POLICY tenant_isolation_select ON staff_order_items
  FOR SELECT TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM staff_orders so
      WHERE so.id = staff_order_id AND so.tenant_id = current_tenant_id()
    )
  );
CREATE POLICY tenant_isolation_modify ON staff_order_items
  FOR ALL TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM staff_orders so
      WHERE so.id = staff_order_id AND so.tenant_id = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_orders so
      WHERE so.id = staff_order_id AND so.tenant_id = current_tenant_id()
    )
  );

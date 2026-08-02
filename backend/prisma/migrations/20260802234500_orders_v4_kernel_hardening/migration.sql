-- Orders V4 kernel hardening.
-- The immutable kernel unit owns all quantities in documents, recipes and ledgers.
-- inventory_unit_id is now only the operator-selected display unit.
ALTER TABLE "orders_v4_items" ADD COLUMN "kernel_unit_id" TEXT;

UPDATE "orders_v4_items"
SET "kernel_unit_id" = "inventory_unit_id"
WHERE "kernel_unit_id" IS NULL;

ALTER TABLE "orders_v4_items" ALTER COLUMN "kernel_unit_id" SET NOT NULL;

CREATE INDEX "orders_v4_items_kernel_unit_id_idx"
  ON "orders_v4_items"("kernel_unit_id");

ALTER TABLE "orders_v4_items"
  ADD CONSTRAINT "orders_v4_items_kernel_unit_id_fkey"
  FOREIGN KEY ("kernel_unit_id") REFERENCES "orders_v4_units"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION orders_v4_prevent_kernel_unit_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.kernel_unit_id IS DISTINCT FROM OLD.kernel_unit_id THEN
    RAISE EXCEPTION 'Orders V4 kernel unit is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_v4_kernel_unit_immutable
BEFORE UPDATE OF kernel_unit_id ON "orders_v4_items"
FOR EACH ROW EXECUTE FUNCTION orders_v4_prevent_kernel_unit_change();

CREATE OR REPLACE FUNCTION orders_v4_validate_kernel_unit_company()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM orders_v4_units
    WHERE id = NEW.kernel_unit_id AND company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Orders V4 kernel unit must belong to the item company';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_v4_kernel_unit_company_guard
BEFORE INSERT ON "orders_v4_items"
FOR EACH ROW EXECUTE FUNCTION orders_v4_validate_kernel_unit_company();

ALTER TABLE "orders_v4_inventory_ledger"
  DROP CONSTRAINT "orders_v4_inventory_entry_type_check";

ALTER TABLE "orders_v4_inventory_ledger"
  ADD CONSTRAINT "orders_v4_inventory_entry_type_check"
  CHECK ("entry_type" IN (
    'receipt', 'issue', 'transfer_in', 'transfer_out',
    'stocktake_adjustment', 'negative_stock_revaluation', 'reversal', 'unit_rebase'
  ));

-- Provision defaults on company creation, never from a read endpoint.
CREATE OR REPLACE FUNCTION orders_v4_provision_company_foundation()
RETURNS trigger AS $$
BEGIN
  INSERT INTO orders_v4_units (
    id, tenant_id, company_id, code, name_ar, name_en, dimension,
    canonical_factor, decimal_scale, sort_order, updated_at
  ) VALUES
    ('ov4u_' || md5(NEW.id || ':piece'), NEW.tenant_id, NEW.id, 'piece', 'حبة', 'Piece', 'count', 1, 3, 10, NOW()),
    ('ov4u_' || md5(NEW.id || ':kg'), NEW.tenant_id, NEW.id, 'kg', 'كيلوجرام', 'Kilogram', 'mass', 1000, 6, 20, NOW()),
    ('ov4u_' || md5(NEW.id || ':g'), NEW.tenant_id, NEW.id, 'g', 'جرام', 'Gram', 'mass', 1, 6, 30, NOW()),
    ('ov4u_' || md5(NEW.id || ':l'), NEW.tenant_id, NEW.id, 'l', 'لتر', 'Liter', 'volume', 1000, 6, 40, NOW()),
    ('ov4u_' || md5(NEW.id || ':ml'), NEW.tenant_id, NEW.id, 'ml', 'ملليلتر', 'Milliliter', 'volume', 1, 6, 50, NOW()),
    ('ov4u_' || md5(NEW.id || ':pack'), NEW.tenant_id, NEW.id, 'pack', 'باكيت', 'Pack', 'package', NULL, 4, 60, NOW()),
    ('ov4u_' || md5(NEW.id || ':box'), NEW.tenant_id, NEW.id, 'box', 'علبة', 'Box', 'package', NULL, 4, 65, NOW()),
    ('ov4u_' || md5(NEW.id || ':carton'), NEW.tenant_id, NEW.id, 'carton', 'كرتون', 'Carton', 'package', NULL, 4, 70, NOW())
  ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO orders_v4_sections (
    id, tenant_id, company_id, code, name_ar, name_en, sort_order, updated_at
  ) VALUES (
    'ov4s_' || md5(NEW.id || ':general'), NEW.tenant_id, NEW.id,
    'general', 'عام', 'General', 10, NOW()
  ) ON CONFLICT (company_id, code) DO NOTHING;

  INSERT INTO orders_v4_locations (
    id, tenant_id, company_id, code, name_ar, name_en, kind, updated_at
  ) VALUES (
    'ov4l_' || md5(NEW.id || ':main'), NEW.tenant_id, NEW.id,
    'main', 'المخزون الرئيسي', 'Main inventory', 'warehouse', NOW()
  ) ON CONFLICT (company_id, code) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_v4_company_foundation ON companies;
CREATE TRIGGER orders_v4_company_foundation
AFTER INSERT ON companies
FOR EACH ROW EXECUTE FUNCTION orders_v4_provision_company_foundation();

-- Backfill all existing companies once. The conflict keys make this idempotent.
DO $$
DECLARE company_row RECORD;
BEGIN
  FOR company_row IN SELECT id, tenant_id FROM companies LOOP
    INSERT INTO orders_v4_units (
      id, tenant_id, company_id, code, name_ar, name_en, dimension,
      canonical_factor, decimal_scale, sort_order, updated_at
    ) VALUES
      ('ov4u_' || md5(company_row.id || ':piece'), company_row.tenant_id, company_row.id, 'piece', 'حبة', 'Piece', 'count', 1, 3, 10, NOW()),
      ('ov4u_' || md5(company_row.id || ':kg'), company_row.tenant_id, company_row.id, 'kg', 'كيلوجرام', 'Kilogram', 'mass', 1000, 6, 20, NOW()),
      ('ov4u_' || md5(company_row.id || ':g'), company_row.tenant_id, company_row.id, 'g', 'جرام', 'Gram', 'mass', 1, 6, 30, NOW()),
      ('ov4u_' || md5(company_row.id || ':l'), company_row.tenant_id, company_row.id, 'l', 'لتر', 'Liter', 'volume', 1000, 6, 40, NOW()),
      ('ov4u_' || md5(company_row.id || ':ml'), company_row.tenant_id, company_row.id, 'ml', 'ملليلتر', 'Milliliter', 'volume', 1, 6, 50, NOW()),
      ('ov4u_' || md5(company_row.id || ':pack'), company_row.tenant_id, company_row.id, 'pack', 'باكيت', 'Pack', 'package', NULL, 4, 60, NOW()),
      ('ov4u_' || md5(company_row.id || ':box'), company_row.tenant_id, company_row.id, 'box', 'علبة', 'Box', 'package', NULL, 4, 65, NOW()),
      ('ov4u_' || md5(company_row.id || ':carton'), company_row.tenant_id, company_row.id, 'carton', 'كرتون', 'Carton', 'package', NULL, 4, 70, NOW())
    ON CONFLICT (company_id, code) DO NOTHING;

    INSERT INTO orders_v4_sections (id, tenant_id, company_id, code, name_ar, name_en, sort_order, updated_at)
    VALUES ('ov4s_' || md5(company_row.id || ':general'), company_row.tenant_id, company_row.id, 'general', 'عام', 'General', 10, NOW())
    ON CONFLICT (company_id, code) DO NOTHING;

    INSERT INTO orders_v4_locations (id, tenant_id, company_id, code, name_ar, name_en, kind, updated_at)
    VALUES ('ov4l_' || md5(company_row.id || ':main'), company_row.tenant_id, company_row.id, 'main', 'المخزون الرئيسي', 'Main inventory', 'warehouse', NOW())
    ON CONFLICT (company_id, code) DO NOTHING;
  END LOOP;
END;
$$;

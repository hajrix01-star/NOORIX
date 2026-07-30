ALTER TABLE "shisha_inventory_settings"
ADD COLUMN "charcoal_consumption_product_id" TEXT,
ADD COLUMN "charcoal_actual_tracking_started_at" DATE;

-- Reuse the Orders catalog as the employee input surface. Existing shisha
-- companies receive one zero-price operational sales item in the Shisha section.
INSERT INTO "order_products" (
  "id",
  "tenant_id",
  "company_id",
  "name_ar",
  "name_en",
  "unit",
  "last_price",
  "sections",
  "section_ids",
  "product_type",
  "is_active",
  "sort_order",
  "created_at",
  "updated_at"
)
SELECT
  'shisha-charcoal-' || SUBSTRING(MD5(settings."company_id") FROM 1 FOR 20),
  settings."tenant_id",
  settings."company_id",
  'استهلاك الفحم الفعلي',
  'Actual charcoal consumption',
  'pack',
  0,
  JSONB_BUILD_ARRAY('شيشة'),
  CASE
    WHEN settings."shisha_section_id" IS NULL THEN NULL
    ELSE JSONB_BUILD_ARRAY(settings."shisha_section_id")
  END,
  'sale',
  TRUE,
  999,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "shisha_inventory_settings" settings
WHERE NOT EXISTS (
  SELECT 1
  FROM "order_products" product
  WHERE product."company_id" = settings."company_id"
    AND product."product_type" = 'sale'
    AND product."name_ar" = 'استهلاك الفحم الفعلي'
);

WITH linked_products AS (
  SELECT DISTINCT ON (product."company_id")
    product."company_id",
    product."id"
  FROM "order_products" product
  WHERE product."product_type" = 'sale'
    AND product."name_ar" = 'استهلاك الفحم الفعلي'
  ORDER BY product."company_id", product."created_at", product."id"
)
UPDATE "shisha_inventory_settings" settings
SET
  "charcoal_consumption_product_id" = linked_products."id",
  "charcoal_actual_tracking_started_at" = CURRENT_DATE,
  "updated_at" = CURRENT_TIMESTAMP
FROM linked_products
WHERE linked_products."company_id" = settings."company_id";

-- Normalize a reused product so it remains an operational input and never
-- affects sales value. The stable product id is the link used by inventory.
UPDATE "order_products" product
SET
  "name_en" = 'Actual charcoal consumption',
  "unit" = 'pack',
  "last_price" = 0,
  "sections" = JSONB_BUILD_ARRAY('شيشة'),
  "section_ids" = CASE
    WHEN settings."shisha_section_id" IS NULL THEN NULL
    ELSE JSONB_BUILD_ARRAY(settings."shisha_section_id")
  END,
  "product_type" = 'sale',
  "is_active" = TRUE,
  "sort_order" = 999,
  "updated_at" = CURRENT_TIMESTAMP
FROM "shisha_inventory_settings" settings
WHERE product."id" = settings."charcoal_consumption_product_id";

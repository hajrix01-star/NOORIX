-- The employee-facing catalog already contained a plain "فحم" item in some
-- companies. Reuse it as the official actual-consumption product so employees
-- see one clear item instead of a parallel technical product.
WITH candidates AS (
  SELECT DISTINCT ON (product."company_id")
    product."company_id",
    product."id"
  FROM "order_products" product
  INNER JOIN "shisha_inventory_settings" settings
    ON settings."company_id" = product."company_id"
  WHERE product."product_type" = 'sale'
    AND product."is_active" = TRUE
    AND (
      TRIM(product."name_ar") IN ('فحم', 'الفحم')
      OR LOWER(TRIM(COALESCE(product."name_en", ''))) = 'charcoal'
    )
  ORDER BY
    product."company_id",
    CASE WHEN TRIM(product."name_ar") = 'فحم' THEN 0 ELSE 1 END,
    product."created_at",
    product."id"
)
UPDATE "shisha_inventory_settings" settings
SET
  "charcoal_consumption_product_id" = candidates."id",
  "updated_at" = CURRENT_TIMESTAMP
FROM candidates
WHERE candidates."company_id" = settings."company_id";

-- Standard employee choices. Multipliers are in the inventory base unit:
-- one box = 64 pieces, one carton = 10 boxes.
UPDATE "order_products" product
SET
  "name_ar" = 'فحم',
  "name_en" = 'Actual charcoal consumption',
  "unit" = 'pack',
  "last_price" = 0,
  "sections" = JSONB_BUILD_ARRAY('شيشة'),
  "section_ids" = CASE
    WHEN settings."shisha_section_id" IS NULL THEN NULL
    ELSE JSONB_BUILD_ARRAY(settings."shisha_section_id")
  END,
  "variants" = JSONB_BUILD_ARRAY(
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'ربع علبة', 'unit', 'pack', 'lastPrice', '0', 'quantityMultiplier', '0.25'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'نصف علبة', 'unit', 'pack', 'lastPrice', '0', 'quantityMultiplier', '0.5'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'علبة', 'unit', 'pack', 'lastPrice', '0', 'quantityMultiplier', '1'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'علبة ونصف', 'unit', 'pack', 'lastPrice', '0', 'quantityMultiplier', '1.5'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'ربع كرتون', 'unit', 'carton', 'lastPrice', '0', 'quantityMultiplier', '2.5'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'نصف كرتون', 'unit', 'carton', 'lastPrice', '0', 'quantityMultiplier', '5'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'كرتون', 'unit', 'carton', 'lastPrice', '0', 'quantityMultiplier', '10'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'كرتون ونصف', 'unit', 'carton', 'lastPrice', '0', 'quantityMultiplier', '15')
  ),
  "product_type" = 'sale',
  "is_active" = TRUE,
  "sort_order" = 999,
  "updated_at" = CURRENT_TIMESTAMP
FROM "shisha_inventory_settings" settings
WHERE product."id" = settings."charcoal_consumption_product_id";

-- Hide obsolete parallel charcoal items from the employee catalog while
-- retaining their rows and history for audit and past-report calculations.
UPDATE "order_products" product
SET
  "is_active" = FALSE,
  "updated_at" = CURRENT_TIMESTAMP
FROM "shisha_inventory_settings" settings
WHERE product."company_id" = settings."company_id"
  AND product."product_type" = 'sale'
  AND product."id" <> settings."charcoal_consumption_product_id"
  AND (
    TRIM(product."name_ar") IN ('فحم', 'الفحم', 'استهلاك الفحم الفعلي')
    OR LOWER(TRIM(COALESCE(product."name_en", ''))) IN ('charcoal', 'actual charcoal consumption')
  );

-- Preserve the meaning of any employee charcoal rows recorded through the
-- previous generic unit picker before these explicit variants existed.
UPDATE "staff_order_items" item
SET "quantity_multiplier" = CASE
  WHEN TRIM(COALESCE(item."packaging", '')) = 'ربع علبة' THEN 0.25
  WHEN TRIM(COALESCE(item."packaging", '')) = 'نصف علبة' THEN 0.5
  WHEN TRIM(COALESCE(item."packaging", '')) = 'علبة ونصف' THEN 1.5
  WHEN TRIM(COALESCE(item."packaging", '')) = 'ربع كرتون' THEN 2.5
  WHEN TRIM(COALESCE(item."packaging", '')) = 'نصف كرتون' THEN 5
  WHEN TRIM(COALESCE(item."packaging", '')) = 'كرتون ونصف' THEN 15
  WHEN TRIM(COALESCE(item."packaging", '')) = 'كرتون' THEN 10
  WHEN LOWER(TRIM(COALESCE(item."unit", ''))) IN ('carton', 'box') THEN 10
  ELSE 1
END
FROM "order_products" product
WHERE item."product_id" = product."id"
  AND product."product_type" = 'sale'
  AND (
    TRIM(product."name_ar") IN ('فحم', 'الفحم', 'استهلاك الفحم الفعلي')
    OR LOWER(TRIM(COALESCE(product."name_en", ''))) IN ('charcoal', 'actual charcoal consumption')
  );

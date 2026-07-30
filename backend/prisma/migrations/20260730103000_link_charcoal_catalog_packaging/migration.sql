ALTER TABLE "order_items"
ADD COLUMN "quantity_multiplier" DECIMAL(18, 4) NOT NULL DEFAULT 1;

ALTER TABLE "staff_order_items"
ADD COLUMN "quantity_multiplier" DECIMAL(18, 4) NOT NULL DEFAULT 1;

ALTER TABLE "shisha_inventory_settings"
ADD COLUMN "charcoal_purchase_product_id" TEXT,
ADD COLUMN "charcoal_purchase_tracking_started_at" TIMESTAMP(3);

-- Reuse the existing purchase catalog product when possible. If the company
-- has no purchase-side charcoal item, provision one in the Shisha section.
INSERT INTO "order_products" (
  "id", "tenant_id", "company_id", "name_ar", "name_en", "unit",
  "last_price", "sections", "section_ids", "product_type", "is_active",
  "sort_order", "created_at", "updated_at"
)
SELECT
  'shisha-charcoal-purchase-' || SUBSTRING(MD5(settings."company_id") FROM 1 FOR 16),
  settings."tenant_id",
  settings."company_id",
  'فحم',
  'Charcoal',
  'pack',
  0,
  JSONB_BUILD_ARRAY('شيشة'),
  CASE
    WHEN settings."shisha_section_id" IS NULL THEN NULL
    ELSE JSONB_BUILD_ARRAY(settings."shisha_section_id")
  END,
  'order',
  TRUE,
  998,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "shisha_inventory_settings" settings
WHERE NOT EXISTS (
  SELECT 1
  FROM "order_products" product
  WHERE product."company_id" = settings."company_id"
    AND product."product_type" = 'order'
    AND (
      TRIM(product."name_ar") IN ('فحم', 'الفحم')
      OR LOWER(TRIM(COALESCE(product."name_en", ''))) = 'charcoal'
    )
);

WITH purchase_products AS (
  SELECT DISTINCT ON (product."company_id")
    product."company_id",
    product."id"
  FROM "order_products" product
  WHERE product."product_type" = 'order'
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
  "charcoal_purchase_product_id" = purchase_products."id",
  "charcoal_purchase_tracking_started_at" = CURRENT_TIMESTAMP,
  "updated_at" = CURRENT_TIMESTAMP
FROM purchase_products
WHERE purchase_products."company_id" = settings."company_id";

-- Standard packaging definitions. Quantity multipliers are expressed in the
-- inventory base unit (one box = 64 charcoal pieces).
WITH purchase_prices AS (
  SELECT
    product."id",
    COALESCE(
      (
        SELECT CASE
          WHEN NULLIF(variant->>'lastPrice', '') ~ '^[0-9]+([.][0-9]+)?$'
            THEN (variant->>'lastPrice')::DECIMAL
          ELSE NULL
        END
        FROM JSONB_ARRAY_ELEMENTS(
          CASE
            WHEN JSONB_TYPEOF(product."variants") = 'array' THEN product."variants"
            ELSE '[]'::JSONB
          END
        ) variant
        WHERE LOWER(TRIM(COALESCE(variant->>'packaging', ''))) IN ('كرتون', 'كرتن', 'carton')
        LIMIT 1
      ),
      product."last_price",
      0
    ) AS carton_price
  FROM "order_products" product
  INNER JOIN "shisha_inventory_settings" settings
    ON settings."charcoal_purchase_product_id" = product."id"
)
UPDATE "order_products" product
SET
  "name_ar" = 'فحم',
  "name_en" = 'Charcoal',
  "unit" = 'pack',
  "sections" = JSONB_BUILD_ARRAY('شيشة'),
  "section_ids" = CASE
    WHEN settings."shisha_section_id" IS NULL THEN NULL
    ELSE JSONB_BUILD_ARRAY(settings."shisha_section_id")
  END,
  "variants" = JSONB_BUILD_ARRAY(
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'ربع علبة', 'unit', 'pack', 'lastPrice', (purchase_prices.carton_price * 0.025)::TEXT, 'quantityMultiplier', '0.25'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'نصف علبة', 'unit', 'pack', 'lastPrice', (purchase_prices.carton_price * 0.05)::TEXT, 'quantityMultiplier', '0.5'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'علبة', 'unit', 'pack', 'lastPrice', (purchase_prices.carton_price * 0.1)::TEXT, 'quantityMultiplier', '1'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'علبة ونصف', 'unit', 'pack', 'lastPrice', (purchase_prices.carton_price * 0.15)::TEXT, 'quantityMultiplier', '1.5'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'ربع كرتون', 'unit', 'carton', 'lastPrice', (purchase_prices.carton_price * 0.25)::TEXT, 'quantityMultiplier', '2.5'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'نصف كرتون', 'unit', 'carton', 'lastPrice', (purchase_prices.carton_price * 0.5)::TEXT, 'quantityMultiplier', '5'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'كرتون', 'unit', 'carton', 'lastPrice', purchase_prices.carton_price::TEXT, 'quantityMultiplier', '10'),
    JSONB_BUILD_OBJECT('size', '', 'packaging', 'كرتون ونصف', 'unit', 'carton', 'lastPrice', (purchase_prices.carton_price * 1.5)::TEXT, 'quantityMultiplier', '15')
  ),
  "product_type" = 'order',
  "is_active" = TRUE,
  "sort_order" = 998,
  "updated_at" = CURRENT_TIMESTAMP
FROM "shisha_inventory_settings" settings
INNER JOIN purchase_prices ON purchase_prices."id" = settings."charcoal_purchase_product_id"
WHERE product."id" = settings."charcoal_purchase_product_id";

UPDATE "order_products" product
SET
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

-- Snapshot the conversion on existing rows so future catalog edits never
-- rewrite the historical meaning of a registered quantity.
UPDATE "order_items" item
SET "quantity_multiplier" = CASE
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) = 'ربع علبة' THEN 0.25
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) = 'نصف علبة' THEN 0.5
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) = 'علبة ونصف' THEN 1.5
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) = 'ربع كرتون' THEN 2.5
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) = 'نصف كرتون' THEN 5
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) IN ('كرتون', 'كرتن', 'carton') THEN 10
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) = 'كرتون ونصف' THEN 15
  ELSE 1
END
FROM "shisha_inventory_settings" settings
WHERE item."product_id" = settings."charcoal_purchase_product_id";

UPDATE "staff_order_items" item
SET "quantity_multiplier" = CASE
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) = 'ربع علبة' THEN 0.25
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) = 'نصف علبة' THEN 0.5
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) = 'علبة ونصف' THEN 1.5
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) = 'ربع كرتون' THEN 2.5
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) = 'نصف كرتون' THEN 5
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) IN ('كرتون', 'كرتن', 'carton') THEN 10
  WHEN LOWER(TRIM(COALESCE(item."packaging", ''))) = 'كرتون ونصف' THEN 15
  ELSE 1
END
FROM "shisha_inventory_settings" settings
WHERE item."product_id" = settings."charcoal_consumption_product_id";

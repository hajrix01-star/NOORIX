-- CreateTable: order_categories
CREATE TABLE IF NOT EXISTS "order_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "order_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: order_products
CREATE TABLE IF NOT EXISTS "order_products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "category_id" TEXT,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "sizes" TEXT,
    "packaging" TEXT,
    "last_price" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "order_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable: orders
CREATE TABLE IF NOT EXISTS "orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "order_date" TIMESTAMP(3) NOT NULL,
    "order_type" TEXT NOT NULL,
    "petty_cash_amount" DECIMAL(18,4),
    "total_amount" DECIMAL(18,4) NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: order_items
CREATE TABLE IF NOT EXISTS "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "size" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "orders_company_id_order_number_key" ON "orders"("company_id", "order_number");
CREATE INDEX IF NOT EXISTS "order_categories_tenant_id_idx" ON "order_categories"("tenant_id");
CREATE INDEX IF NOT EXISTS "order_categories_company_id_idx" ON "order_categories"("company_id");
CREATE INDEX IF NOT EXISTS "order_products_tenant_id_idx" ON "order_products"("tenant_id");
CREATE INDEX IF NOT EXISTS "order_products_company_id_idx" ON "order_products"("company_id");
CREATE INDEX IF NOT EXISTS "order_products_company_id_category_id_idx" ON "order_products"("company_id", "category_id");
CREATE INDEX IF NOT EXISTS "orders_tenant_id_idx" ON "orders"("tenant_id");
CREATE INDEX IF NOT EXISTS "orders_company_id_idx" ON "orders"("company_id");
CREATE INDEX IF NOT EXISTS "orders_company_id_order_date_idx" ON "orders"("company_id", "order_date");
CREATE INDEX IF NOT EXISTS "order_items_order_id_idx" ON "order_items"("order_id");
CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items"("product_id");

DO $$ BEGIN
  ALTER TABLE "order_categories" ADD CONSTRAINT "order_categories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "order_products" ADD CONSTRAINT "order_products_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "order_products" ADD CONSTRAINT "order_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "order_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "order_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

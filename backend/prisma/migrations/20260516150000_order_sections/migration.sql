-- CreateTable: order_sections — قائمة الأقسام (مطبخ، بار، كاشير، ...)
CREATE TABLE IF NOT EXISTS "order_sections" (
  "id"          TEXT NOT NULL,
  "tenant_id"   TEXT NOT NULL,
  "company_id"  TEXT NOT NULL,
  "name_ar"     TEXT NOT NULL,
  "name_en"     TEXT,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_sections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "order_sections_tenant_id_idx"  ON "order_sections"("tenant_id");
CREATE INDEX IF NOT EXISTS "order_sections_company_id_idx" ON "order_sections"("company_id");

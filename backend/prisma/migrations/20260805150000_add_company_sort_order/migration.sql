ALTER TABLE "companies"
  ADD COLUMN "sort_order" INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "tenant_id"
      ORDER BY "is_archived" ASC, "name_ar" ASC, "created_at" ASC, "id" ASC
    )::INTEGER AS "position"
  FROM "companies"
)
UPDATE "companies" AS company
SET "sort_order" = ranked."position"
FROM ranked
WHERE ranked."id" = company."id";

CREATE INDEX "companies_tenant_id_sort_order_idx"
  ON "companies"("tenant_id", "sort_order");

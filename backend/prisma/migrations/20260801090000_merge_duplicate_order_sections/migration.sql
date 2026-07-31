BEGIN;

-- Keep section labels stable before comparing them.
UPDATE "order_sections"
SET "name_ar" = regexp_replace(btrim("name_ar"), '[[:space:]]+', ' ', 'g')
WHERE "name_ar" IS DISTINCT FROM regexp_replace(btrim("name_ar"), '[[:space:]]+', ' ', 'g');

CREATE TEMP TABLE "duplicate_order_section_map" ON COMMIT DROP AS
WITH "ranked_sections" AS (
  SELECT
    "id",
    first_value("id") OVER (
      PARTITION BY
        "company_id",
        lower(regexp_replace(btrim("name_ar"), '[[:space:]]+', ' ', 'g'))
      ORDER BY "sort_order", "created_at", "id"
    ) AS "canonical_id"
  FROM "order_sections"
)
SELECT "id" AS "duplicate_id", "canonical_id"
FROM "ranked_sections"
WHERE "id" <> "canonical_id";

-- Repoint every product to the canonical section id and remove duplicate ids.
UPDATE "order_products" AS "product"
SET "section_ids" = (
  SELECT CASE
    WHEN count(*) = 0 THEN NULL
    ELSE jsonb_agg("deduplicated"."section_id" ORDER BY "deduplicated"."first_position")
  END
  FROM (
    SELECT
      coalesce("mapping"."canonical_id", "entry"."section_id") AS "section_id",
      min("entry"."position") AS "first_position"
    FROM jsonb_array_elements_text("product"."section_ids") WITH ORDINALITY
      AS "entry"("section_id", "position")
    LEFT JOIN "duplicate_order_section_map" AS "mapping"
      ON "mapping"."duplicate_id" = "entry"."section_id"
    GROUP BY coalesce("mapping"."canonical_id", "entry"."section_id")
  ) AS "deduplicated"
)
WHERE jsonb_typeof("product"."section_ids") = 'array';

-- Repair legacy products that only retained section names.
UPDATE "order_products" AS "product"
SET "section_ids" = (
  SELECT CASE
    WHEN count(*) = 0 THEN NULL
    ELSE jsonb_agg("matched"."section_id" ORDER BY "matched"."first_position")
  END
  FROM (
    SELECT "section"."id" AS "section_id", min("entry"."position") AS "first_position"
    FROM jsonb_array_elements_text("product"."sections") WITH ORDINALITY
      AS "entry"("section_name", "position")
    JOIN LATERAL (
      SELECT "candidate"."id"
      FROM "order_sections" AS "candidate"
      WHERE "candidate"."company_id" = "product"."company_id"
        AND lower(regexp_replace(btrim("candidate"."name_ar"), '[[:space:]]+', ' ', 'g')) =
            lower(regexp_replace(btrim("entry"."section_name"), '[[:space:]]+', ' ', 'g'))
      ORDER BY "candidate"."sort_order", "candidate"."created_at", "candidate"."id"
      LIMIT 1
    ) AS "section" ON true
    GROUP BY "section"."id"
  ) AS "matched"
)
WHERE jsonb_typeof("product"."sections") = 'array'
  AND (
    "product"."section_ids" IS NULL
    OR jsonb_typeof("product"."section_ids") <> 'array'
    OR jsonb_array_length("product"."section_ids") = 0
  );

DELETE FROM "order_sections" AS "section"
USING "duplicate_order_section_map" AS "mapping"
WHERE "section"."id" = "mapping"."duplicate_id";

-- Rebuild compatibility labels from canonical ids.
UPDATE "order_products" AS "product"
SET "sections" = (
  SELECT CASE
    WHEN count(*) = 0 THEN NULL
    ELSE jsonb_agg("section"."name_ar" ORDER BY "entry"."position")
  END
  FROM jsonb_array_elements_text("product"."section_ids") WITH ORDINALITY
    AS "entry"("section_id", "position")
  JOIN "order_sections" AS "section" ON "section"."id" = "entry"."section_id"
)
WHERE jsonb_typeof("product"."section_ids") = 'array';

CREATE UNIQUE INDEX IF NOT EXISTS "order_sections_company_normalized_name_key"
ON "order_sections" (
  "company_id",
  lower(regexp_replace(btrim("name_ar"), '[[:space:]]+', ' ', 'g'))
)
WHERE btrim("name_ar") <> '';

COMMIT;

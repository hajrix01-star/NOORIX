-- Targeted rollback for 20260728193000_add_supplier_directory.
-- Run only after the previous application version has been restored.

BEGIN;

UPDATE "suppliers"
SET "directory_entry_id" = NULL,
    "directory_managed" = false
WHERE "directory_entry_id" IS NOT NULL
   OR "directory_managed" = true;

ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "suppliers_directory_entry_id_fkey";
DROP INDEX IF EXISTS "suppliers_company_id_directory_entry_id_key";
DROP INDEX IF EXISTS "suppliers_directory_entry_id_idx";
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "directory_entry_id";
ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "directory_managed";
DROP TABLE IF EXISTS "supplier_directory_entries";

-- E2-8 may predate this release, so it is never removed here.
DELETE FROM "categories" c
WHERE c."code" IN ('E2-10', 'E2-11')
  AND c."id" LIKE 'seed\_%' ESCAPE '\'
  AND NOT EXISTS (SELECT 1 FROM "suppliers" s WHERE s."supplier_category_id" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "expense_lines" e WHERE e."category_id" = c."id");

COMMIT;

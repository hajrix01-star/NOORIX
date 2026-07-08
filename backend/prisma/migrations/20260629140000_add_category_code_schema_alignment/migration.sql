-- Align categories table with Prisma schema before local seed creates master categories.

ALTER TABLE "categories"
  ADD COLUMN IF NOT EXISTS "code" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "categories_company_id_code_key"
  ON "categories"("company_id", "code");

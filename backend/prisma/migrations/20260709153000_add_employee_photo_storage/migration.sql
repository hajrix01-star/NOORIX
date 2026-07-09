ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "photo_path" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "photo_mime" TEXT;
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "photo_original_name" TEXT;

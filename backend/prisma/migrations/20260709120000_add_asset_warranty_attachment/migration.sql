ALTER TABLE "company_assets"
  ADD COLUMN IF NOT EXISTS "warranty_attachment_path" TEXT,
  ADD COLUMN IF NOT EXISTS "warranty_attachment_original_name" VARCHAR(240),
  ADD COLUMN IF NOT EXISTS "warranty_attachment_mime" VARCHAR(80);

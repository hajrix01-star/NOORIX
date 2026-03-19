-- AlterTable: إضافة حقول قناة البيع وطريقة السداد والأرشفة للخزائن
ALTER TABLE "vaults"
  ADD COLUMN IF NOT EXISTS "is_archived"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_sales_channel" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "payment_method"  TEXT,
  ADD COLUMN IF NOT EXISTS "notes"           TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "vaults_company_id_is_archived_idx" ON "vaults"("company_id", "is_archived");

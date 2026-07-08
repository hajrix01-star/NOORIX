-- DropIndex
DROP INDEX "invoices_company_id_supplier_id_invoice_number_key";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "icon" TEXT,
ADD COLUMN     "tax_exempt" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "account_id" TEXT;

-- AlterTable
DO $$
BEGIN
  IF to_regclass('public.employees') IS NOT NULL THEN
    ALTER TABLE "employees" ALTER COLUMN "updated_at" DROP DEFAULT;
  END IF;
END $$;

-- AlterTable
ALTER TABLE "roles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
DO $$
BEGIN
  IF to_regclass('public.tenants') IS NOT NULL THEN
    ALTER TABLE "tenants" ALTER COLUMN "updated_at" DROP DEFAULT;
  END IF;
END $$;

-- CreateIndex
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'tenant_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id");
  END IF;
END $$;

-- CreateIndex
CREATE INDEX "categories_account_id_idx" ON "categories"("account_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

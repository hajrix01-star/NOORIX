-- منشئ سجل الفاتورة (مستخدم النظام)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "invoices_company_id_created_by_user_id_idx" ON "invoices"("company_id", "created_by_user_id");

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

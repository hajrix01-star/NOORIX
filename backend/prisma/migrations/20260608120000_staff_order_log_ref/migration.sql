-- رقم عملية مختصر للتسجيل الداخلي (يربط أقسام الإرسال الواحد)
ALTER TABLE "staff_orders" ADD COLUMN IF NOT EXISTS "log_ref" TEXT;

CREATE INDEX IF NOT EXISTS "staff_orders_company_id_log_ref_idx"
  ON "staff_orders"("company_id", "log_ref");

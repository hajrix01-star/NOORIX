-- CreateTable: الفترات المالية
CREATE TABLE IF NOT EXISTS "fiscal_periods" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closed_at" TIMESTAMP(3),
    "closed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fiscal_periods_company_id_start_date_key" ON "fiscal_periods"("company_id", "start_date");
CREATE INDEX IF NOT EXISTS "fiscal_periods_tenant_id_idx" ON "fiscal_periods"("tenant_id");
CREATE INDEX IF NOT EXISTS "fiscal_periods_company_id_idx" ON "fiscal_periods"("company_id");
CREATE INDEX IF NOT EXISTS "fiscal_periods_company_id_status_idx" ON "fiscal_periods"("company_id", "status");

-- CreateTable: مفاتيح عدم التكرار
CREATE TABLE IF NOT EXISTS "idempotency_keys" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "result_json" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_keys_company_id_key_hash_key" ON "idempotency_keys"("company_id", "key_hash");
CREATE INDEX IF NOT EXISTS "idempotency_keys_tenant_id_idx" ON "idempotency_keys"("tenant_id");
CREATE INDEX IF NOT EXISTS "idempotency_keys_company_id_idx" ON "idempotency_keys"("company_id");
CREATE INDEX IF NOT EXISTS "idempotency_keys_expires_at_idx" ON "idempotency_keys"("expires_at");

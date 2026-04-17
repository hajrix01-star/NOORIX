-- إعدادات النسخ اليومي التلقائي لكل شركة (لقطة منطقية)
CREATE TABLE "company_backup_config" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "schedule_hour" INTEGER NOT NULL DEFAULT 6,
    "schedule_minute" INTEGER NOT NULL DEFAULT 0,
    "retention_count" INTEGER NOT NULL DEFAULT 5,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "last_run_day_riyadh" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_backup_config_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_backup_config_company_id_key" ON "company_backup_config"("company_id");

CREATE INDEX "company_backup_config_tenant_id_idx" ON "company_backup_config"("tenant_id");

ALTER TABLE "company_backup_config" ADD CONSTRAINT "company_backup_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_backup_config" ADD CONSTRAINT "company_backup_config_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

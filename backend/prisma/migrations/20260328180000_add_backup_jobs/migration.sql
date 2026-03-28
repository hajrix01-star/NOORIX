-- النسخ الاحتياطي الذكي — سجل المهام والملفات المحلية
CREATE TABLE "backup_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "company_id" TEXT,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "content_hash" TEXT,
    "local_relative_path" TEXT,
    "size_bytes" BIGINT,
    "duration_ms" INTEGER,
    "report" JSONB,
    "error_message" TEXT,
    "external_uploaded" BOOLEAN NOT NULL DEFAULT false,
    "external_error" TEXT,
    "duplicate_of_job_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,

    CONSTRAINT "backup_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "backup_jobs_tenant_id_created_at_idx" ON "backup_jobs"("tenant_id", "created_at");
CREATE INDEX "backup_jobs_company_id_created_at_idx" ON "backup_jobs"("company_id", "created_at");

ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "backup_jobs" ADD CONSTRAINT "backup_jobs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

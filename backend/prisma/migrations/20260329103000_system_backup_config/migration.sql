-- إعدادات النسخ التلقائي + حقول التحقق والترقيم لـ backup_jobs
CREATE TABLE "system_backup_config" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "schedule_hour" INTEGER NOT NULL DEFAULT 6,
    "schedule_minute" INTEGER NOT NULL DEFAULT 0,
    "retention_count" INTEGER NOT NULL DEFAULT 10,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "last_run_day_riyadh" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_backup_config_pkey" PRIMARY KEY ("id")
);

INSERT INTO "system_backup_config" ("id", "enabled", "schedule_hour", "schedule_minute", "retention_count", "timezone", "created_at", "updated_at")
VALUES ('singleton', false, 6, 0, 10, 'Asia/Riyadh', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "backup_jobs" ADD COLUMN "ordinal" INTEGER;
ALTER TABLE "backup_jobs" ADD COLUMN "verified_at" TIMESTAMP(3);
ALTER TABLE "backup_jobs" ADD COLUMN "verify_ok" BOOLEAN;
ALTER TABLE "backup_jobs" ADD COLUMN "verify_error" TEXT;

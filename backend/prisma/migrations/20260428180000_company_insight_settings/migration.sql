-- حدود تنبيهات الرؤى المالية لكل شركة (Phase A — تخزين فقط)
CREATE TABLE "company_insight_settings" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "thresholds" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_insight_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_insight_settings_company_id_key" ON "company_insight_settings"("company_id");

ALTER TABLE "company_insight_settings" ADD CONSTRAINT "company_insight_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

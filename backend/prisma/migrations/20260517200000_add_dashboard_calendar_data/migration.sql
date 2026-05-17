-- CreateTable: dashboard_calendar_data
-- أهداف المبيعات، الأيام الخاصة، وملاحظات الأيام لكل شركة/سنة/شهر

CREATE TABLE "dashboard_calendar_data" (
    "id"           TEXT NOT NULL,
    "tenant_id"    TEXT NOT NULL,
    "company_id"   TEXT NOT NULL,
    "year"         INTEGER NOT NULL,
    "month"        INTEGER NOT NULL,
    "targets"      JSONB NOT NULL DEFAULT '{"overall":null,"byDow":{}}',
    "special_days" JSONB NOT NULL DEFAULT '[]',
    "day_notes"    JSONB NOT NULL DEFAULT '{}',
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboard_calendar_data_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_calendar_data_company_id_year_month_key"
    ON "dashboard_calendar_data"("company_id", "year", "month");

CREATE INDEX "dashboard_calendar_data_tenant_id_idx"
    ON "dashboard_calendar_data"("tenant_id");

CREATE INDEX "dashboard_calendar_data_tenant_id_company_id_idx"
    ON "dashboard_calendar_data"("tenant_id", "company_id");

CREATE INDEX "dashboard_calendar_data_company_id_idx"
    ON "dashboard_calendar_data"("company_id");

-- AddForeignKey
ALTER TABLE "dashboard_calendar_data"
    ADD CONSTRAINT "dashboard_calendar_data_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

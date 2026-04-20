-- سجل ضريبي تخطيطي معزول عن المحاسبة
CREATE TABLE "vat_planning_quarters" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "source_snapshot" JSONB,
    "payment_target" DECIMAL(18,4),
    "notes" TEXT,
    "imported_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vat_planning_quarters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vat_planning_quarters_company_id_year_quarter_key" ON "vat_planning_quarters"("company_id", "year", "quarter");
CREATE INDEX "vat_planning_quarters_tenant_id_idx" ON "vat_planning_quarters"("tenant_id");
CREATE INDEX "vat_planning_quarters_company_id_year_idx" ON "vat_planning_quarters"("company_id", "year");

ALTER TABLE "vat_planning_quarters" ADD CONSTRAINT "vat_planning_quarters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

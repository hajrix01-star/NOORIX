-- متابعة ضمان من المشتريات (بدون مدة على الفاتورة)
ALTER TABLE "invoices" ADD COLUMN "warranty_follow_up" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoices" ADD COLUMN "warranty_follow_up_done" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "invoices_company_kind_warranty_queue_idx" ON "invoices"("company_id", "kind", "warranty_follow_up", "warranty_follow_up_done");

-- أسطر تفصيل ضمان اختيارية لكل أصل
CREATE TABLE "company_asset_warranty_lines" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "company_asset_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "serial_number" TEXT,
    "quantity" DECIMAL(18,4),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_asset_warranty_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "company_asset_warranty_lines_tenant_id_idx" ON "company_asset_warranty_lines"("tenant_id");
CREATE INDEX "company_asset_warranty_lines_company_id_idx" ON "company_asset_warranty_lines"("company_id");
CREATE INDEX "company_asset_warranty_lines_company_asset_id_idx" ON "company_asset_warranty_lines"("company_asset_id");

ALTER TABLE "company_asset_warranty_lines" ADD CONSTRAINT "company_asset_warranty_lines_company_asset_id_fkey" FOREIGN KEY ("company_asset_id") REFERENCES "company_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "company_assets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT,
    "serial_number" TEXT,
    "location" TEXT,
    "purchase_date" DATE,
    "acquisition_cost" DECIMAL(18,2),
    "supplier_id" TEXT,
    "invoice_id" TEXT,
    "warranty_description" TEXT,
    "warranty_months" INTEGER,
    "warranty_start_date" DATE,
    "warranty_end_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "company_assets_tenant_id_idx" ON "company_assets"("tenant_id");

-- CreateIndex
CREATE INDEX "company_assets_company_id_idx" ON "company_assets"("company_id");

-- CreateIndex
CREATE INDEX "company_assets_company_id_purchase_date_idx" ON "company_assets"("company_id", "purchase_date");

-- CreateIndex
CREATE INDEX "company_assets_company_id_warranty_end_date_idx" ON "company_assets"("company_id", "warranty_end_date");

-- AddForeignKey
ALTER TABLE "company_assets" ADD CONSTRAINT "company_assets_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_assets" ADD CONSTRAINT "company_assets_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_assets" ADD CONSTRAINT "company_assets_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

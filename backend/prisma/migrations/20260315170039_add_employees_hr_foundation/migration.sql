-- ============================================================
-- MIGRATION: add_employees_hr_foundation
-- =============================================  ===============
-- الخطوات:
--   1. إنشاء جدول tenants (المنظمات)
--   2. إدخال tenant افتراضي للبيانات الموجودة
--   3. إضافة tenant_id لجميع الجداول التشغيلية
--   4. إنشاء جدول employees (الموظفون)
--   5. إضافة employee_id + invoice_date للفواتير والقيود
--   6. تحديث القيود (supplier_id اختياري، unique constraint جديد)
-- ============================================================

-- ─── 1. جدول المنظمات (Tenants) ───────────────────────────
CREATE TABLE IF NOT EXISTS "tenants" (
    "id"           TEXT         NOT NULL,
    "name"         TEXT         NOT NULL,
    "slug"         TEXT         NOT NULL,
    "plan"         TEXT         NOT NULL DEFAULT 'starter',
    "is_active"    BOOLEAN      NOT NULL DEFAULT true,
    "max_companies" INTEGER     NOT NULL DEFAULT 5,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");

-- ─── 2. Tenant افتراضي للبيانات الموجودة ─────────────────
INSERT INTO "tenants" ("id","name","slug","plan","is_active","max_companies","updated_at")
VALUES ('default-tenant-noorix-2024','مجموعة أبو مسعود','abumasoud-group','enterprise',true,10,NOW())
ON CONFLICT ("slug") DO NOTHING;

-- ─── 3. إضافة tenant_id لجميع الجداول (مع backfill تلقائي) ─
ALTER TABLE "accounts"              ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default-tenant-noorix-2024';
ALTER TABLE "audit_logs"            ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default-tenant-noorix-2024';
ALTER TABLE "categories"            ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default-tenant-noorix-2024';
ALTER TABLE "companies"             ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default-tenant-noorix-2024';
ALTER TABLE "daily_sales_summaries" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default-tenant-noorix-2024';
ALTER TABLE "invoices"              ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default-tenant-noorix-2024';
ALTER TABLE "ledger_entries"        ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default-tenant-noorix-2024';
ALTER TABLE "suppliers"             ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default-tenant-noorix-2024';
ALTER TABLE "users"                 ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default-tenant-noorix-2024';
ALTER TABLE "vaults"                ADD COLUMN IF NOT EXISTS "tenant_id" TEXT NOT NULL DEFAULT 'default-tenant-noorix-2024';

-- إزالة القيم الافتراضية (tenant_id يجب أن يُمرَّر صراحةً بعد الآن)
ALTER TABLE "accounts"              ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "audit_logs"            ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "categories"            ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "companies"             ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "daily_sales_summaries" ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "invoices"              ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "ledger_entries"        ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "suppliers"             ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "users"                 ALTER COLUMN "tenant_id" DROP DEFAULT;
ALTER TABLE "vaults"                ALTER COLUMN "tenant_id" DROP DEFAULT;

-- ربط الشركات بالـ Tenant
ALTER TABLE "companies"
    ADD CONSTRAINT "companies_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ربط المستخدمين بالـ Tenant
ALTER TABLE "users"
    ADD CONSTRAINT "users_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes للـ tenant_id
CREATE INDEX IF NOT EXISTS "accounts_tenant_id_idx"              ON "accounts"("tenant_id");
CREATE INDEX IF NOT EXISTS "categories_tenant_id_idx"            ON "categories"("tenant_id");
CREATE INDEX IF NOT EXISTS "companies_tenant_id_idx"             ON "companies"("tenant_id");
CREATE INDEX IF NOT EXISTS "daily_sales_summaries_tenant_id_idx" ON "daily_sales_summaries"("tenant_id");
CREATE INDEX IF NOT EXISTS "invoices_tenant_id_idx"              ON "invoices"("tenant_id");
CREATE INDEX IF NOT EXISTS "ledger_entries_tenant_id_idx"        ON "ledger_entries"("tenant_id");
CREATE INDEX IF NOT EXISTS "suppliers_tenant_id_idx"             ON "suppliers"("tenant_id");
CREATE INDEX IF NOT EXISTS "users_tenant_id_idx"                 ON "users"("tenant_id");
CREATE INDEX IF NOT EXISTS "vaults_tenant_id_idx"                ON "vaults"("tenant_id");

-- ─── 4. جدول الموظفين (Employees) ────────────────────────
CREATE TABLE IF NOT EXISTS "employees" (
    "id"                   TEXT            NOT NULL,
    "tenant_id"            TEXT            NOT NULL,
    "company_id"           TEXT            NOT NULL,
    "name"                 TEXT            NOT NULL,
    "name_en"              TEXT,
    "iqama_number"         TEXT,
    "job_title"            TEXT,
    "basic_salary"         DECIMAL(18, 4)  NOT NULL,
    "housing_allowance"    DECIMAL(18, 4)  NOT NULL DEFAULT 0,
    "transport_allowance"  DECIMAL(18, 4)  NOT NULL DEFAULT 0,
    "join_date"            TIMESTAMP(3)    NOT NULL,
    "status"               TEXT            NOT NULL DEFAULT 'active',
    "notes"                TEXT,
    "created_at"           TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- Indexes للموظفين
CREATE INDEX IF NOT EXISTS "employees_tenant_id_idx"           ON "employees"("tenant_id");
CREATE INDEX IF NOT EXISTS "employees_company_id_idx"          ON "employees"("company_id");
CREATE INDEX IF NOT EXISTS "employees_company_id_status_idx"   ON "employees"("company_id", "status");

-- FK للموظفين
ALTER TABLE "employees"
    ADD CONSTRAINT "employees_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── 5. تحديث جدول الفواتير (Invoices) ───────────────────
-- إضافة invoice_date (تاريخ الفاتورة الأصلية)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_date" TIMESTAMP(3);

-- إضافة employee_id (مرتبط بالموظف للرواتب/السلفيات)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "employee_id" TEXT;

-- جعل supplier_id اختيارياً (للرواتب/السلفيات بلا مورد)
ALTER TABLE "invoices" ALTER COLUMN "supplier_id" DROP NOT NULL;

-- تحديث unique constraint (كان: company_id + supplier_id + invoice_number)
-- الجديد: company_id + invoice_number فقط (لأن supplier_id قد يكون NULL)
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_company_id_supplier_id_invoice_number_key";
ALTER TABLE "invoices" DROP CONSTRAINT IF EXISTS "invoices_company_id_invoice_number_key";
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_invoice_number_key"
    UNIQUE ("company_id", "invoice_number");

-- Index للموظف في الفواتير
CREATE INDEX IF NOT EXISTS "invoices_company_id_employee_id_idx" ON "invoices"("company_id", "employee_id");

-- FK للموظف في الفواتير
ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 6. تحديث جدول القيود (LedgerEntries) ─────────────────
-- إضافة employee_id
ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "employee_id" TEXT;

-- Index للموظف في القيود
CREATE INDEX IF NOT EXISTS "ledger_entries_company_id_employee_id_idx"
    ON "ledger_entries"("company_id", "employee_id");

-- FK للموظف في القيود
ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 7. إضافة عمود created_by_id للقيود (إن لم يكن موجوداً) ─
ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;
ALTER TABLE "daily_sales_summaries" ADD COLUMN IF NOT EXISTS "created_by_id" TEXT;

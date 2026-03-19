-- ============================================================
-- NOORIX — Migration: إضافة Tenant + backfill tenantId
-- يُنفَّذ بعد `prisma migrate dev` الذي يُنشئ جدول tenants
-- ويضيف العمود tenant_id كـ nullable أولاً.
-- ============================================================

-- ── الخطوة 1: إنشاء Tenant افتراضي للبيانات الموجودة ────────
INSERT INTO tenants (id, name, slug, plan, is_active, max_companies, created_at, updated_at)
VALUES (
  'default-tenant-noorix-2024',
  'نوركس — المؤسسة الافتراضية',
  'noorix-default',
  'enterprise',
  true,
  100,
  NOW(),
  NOW()
)
ON CONFLICT (slug) DO NOTHING;

-- ── الخطوة 2: backfill tenant_id في جميع الجداول ────────────

-- Companies
UPDATE companies
SET    tenant_id = 'default-tenant-noorix-2024'
WHERE  tenant_id IS NULL;

-- Users
UPDATE users
SET    tenant_id = 'default-tenant-noorix-2024'
WHERE  tenant_id IS NULL;

-- Categories
UPDATE categories
SET    tenant_id = (
  SELECT c.tenant_id FROM companies c WHERE c.id = categories.company_id LIMIT 1
)
WHERE tenant_id IS NULL;

-- Suppliers
UPDATE suppliers
SET    tenant_id = (
  SELECT c.tenant_id FROM companies c WHERE c.id = suppliers.company_id LIMIT 1
)
WHERE tenant_id IS NULL;

-- Accounts
UPDATE accounts
SET    tenant_id = (
  SELECT c.tenant_id FROM companies c WHERE c.id = accounts.company_id LIMIT 1
)
WHERE tenant_id IS NULL;

-- Vaults
UPDATE vaults
SET    tenant_id = (
  SELECT c.tenant_id FROM companies c WHERE c.id = vaults.company_id LIMIT 1
)
WHERE tenant_id IS NULL;

-- Invoices
UPDATE invoices
SET    tenant_id = (
  SELECT c.tenant_id FROM companies c WHERE c.id = invoices.company_id LIMIT 1
)
WHERE tenant_id IS NULL;

-- Daily Sales Summaries
UPDATE daily_sales_summaries
SET    tenant_id = (
  SELECT c.tenant_id FROM companies c WHERE c.id = daily_sales_summaries.company_id LIMIT 1
)
WHERE tenant_id IS NULL;

-- Ledger Entries
UPDATE ledger_entries
SET    tenant_id = (
  SELECT c.tenant_id FROM companies c WHERE c.id = ledger_entries.company_id LIMIT 1
)
WHERE tenant_id IS NULL;

-- Audit Logs
UPDATE audit_logs
SET    tenant_id = (
  SELECT c.tenant_id FROM companies c WHERE c.id = audit_logs.company_id LIMIT 1
)
WHERE tenant_id IS NULL;

-- ── الخطوة 3: جعل tenant_id إلزامياً (NOT NULL) ──────────────
-- يُنفَّذ بعد التأكد من أن جميع الصفوف تحمل قيمة

ALTER TABLE companies             ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE users                 ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE categories            ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE suppliers             ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE accounts              ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE vaults                ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE invoices              ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE daily_sales_summaries ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE ledger_entries        ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE audit_logs            ALTER COLUMN tenant_id SET NOT NULL;

-- ── الخطوة 4: إضافة Indexes على tenant_id (إن لم تُنشأ بـ Prisma) ──
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_companies_tenant             ON companies             (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_tenant                 ON users                 (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_tenant            ON categories            (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_suppliers_tenant             ON suppliers             (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_tenant              ON accounts              (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_vaults_tenant                ON vaults                (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invoices_tenant              ON invoices              (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_sales_summaries_tenant ON daily_sales_summaries (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ledger_entries_tenant        ON ledger_entries        (tenant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_tenant            ON audit_logs            (tenant_id);

-- ── التحقق النهائي ─────────────────────────────────────────
DO $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM companies WHERE tenant_id IS NULL;
  IF cnt > 0 THEN RAISE EXCEPTION 'BACKFILL FAILED: % rows in companies still have NULL tenant_id', cnt; END IF;

  SELECT COUNT(*) INTO cnt FROM invoices WHERE tenant_id IS NULL;
  IF cnt > 0 THEN RAISE EXCEPTION 'BACKFILL FAILED: % rows in invoices still have NULL tenant_id', cnt; END IF;

  SELECT COUNT(*) INTO cnt FROM ledger_entries WHERE tenant_id IS NULL;
  IF cnt > 0 THEN RAISE EXCEPTION 'BACKFILL FAILED: % rows in ledger_entries still have NULL tenant_id', cnt; END IF;

  RAISE NOTICE '✅ Backfill completed successfully. All tables have tenant_id set.';
END $$;

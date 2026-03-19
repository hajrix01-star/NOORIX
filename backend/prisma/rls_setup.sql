-- ============================================================
-- NOORIX — Row Level Security (RLS) Setup
-- يُنفَّذ مرة واحدة على قاعدة البيانات بعد migration Prisma
-- المتغير: app.current_tenant_id (يُحقن من NestJS قبل كل query)
-- ============================================================

-- ── دور التطبيق (Application Role) ──────────────────────────
-- إذا كان يوجد دور منفصل للتطبيق غير postgres، عدّل هنا
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'noorix_app') THEN
    CREATE ROLE noorix_app LOGIN PASSWORD 'CHANGE_ME_IN_PRODUCTION';
  END IF;
END
$$;

-- منح الصلاحيات الأساسية للـ Application Role
GRANT USAGE ON SCHEMA public TO noorix_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO noorix_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO noorix_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO noorix_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO noorix_app;

-- ── دالة مساعدة: جلب current_tenant_id من إعدادات الجلسة ───
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS TEXT
LANGUAGE SQL STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_tenant_id', true), '')
$$;

-- ── تفعيل RLS على جميع جداول العمليات ──────────────────────

-- Tenants: مرئية دائماً (للـ Bootstrap)
-- Companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;

-- Users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

-- User Companies
ALTER TABLE user_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_companies FORCE ROW LEVEL SECURITY;

-- Categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;

-- Suppliers
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers FORCE ROW LEVEL SECURITY;

-- Accounts
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts FORCE ROW LEVEL SECURITY;

-- Vaults
ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaults FORCE ROW LEVEL SECURITY;

-- Invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

-- Daily Sales Summaries
ALTER TABLE daily_sales_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales_summaries FORCE ROW LEVEL SECURITY;

-- Daily Sales Channels (فرعي — يرث الحماية من الجدول الأب)
ALTER TABLE daily_sales_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales_channels FORCE ROW LEVEL SECURITY;

-- Ledger Entries
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries FORCE ROW LEVEL SECURITY;

-- Audit Logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

-- Employees
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees FORCE ROW LEVEL SECURITY;

-- ── إنشاء Policies: قراءة وكتابة مقيّدة بالـ tenant_id ──────

-- Companies
DROP POLICY IF EXISTS tenant_isolation_select ON companies;
DROP POLICY IF EXISTS tenant_isolation_modify ON companies;
CREATE POLICY tenant_isolation_select ON companies
  FOR SELECT TO PUBLIC
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_modify ON companies
  FOR ALL TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Users (SELECT: allow when tenant matches OR no tenant for login flow)
DROP POLICY IF EXISTS tenant_isolation_select ON users;
DROP POLICY IF EXISTS tenant_isolation_modify ON users;
CREATE POLICY tenant_isolation_select ON users
  FOR SELECT TO PUBLIC
  USING (
    tenant_id = current_tenant_id()
    OR (current_tenant_id() IS NULL OR current_tenant_id() = '')
  );
CREATE POLICY tenant_isolation_modify ON users
  FOR ALL TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- User Companies (يرث tenant isolation من users وcompanies)
DROP POLICY IF EXISTS tenant_isolation_select ON user_companies;
DROP POLICY IF EXISTS tenant_isolation_modify ON user_companies;
CREATE POLICY tenant_isolation_select ON user_companies
  FOR SELECT TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_id AND u.tenant_id = current_tenant_id()
    )
  );
CREATE POLICY tenant_isolation_modify ON user_companies
  FOR ALL TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_id AND u.tenant_id = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = user_id AND u.tenant_id = current_tenant_id()
    )
  );

-- Categories
DROP POLICY IF EXISTS tenant_isolation_select ON categories;
DROP POLICY IF EXISTS tenant_isolation_modify ON categories;
CREATE POLICY tenant_isolation_select ON categories
  FOR SELECT TO PUBLIC
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_modify ON categories
  FOR ALL TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Suppliers
DROP POLICY IF EXISTS tenant_isolation_select ON suppliers;
DROP POLICY IF EXISTS tenant_isolation_modify ON suppliers;
CREATE POLICY tenant_isolation_select ON suppliers
  FOR SELECT TO PUBLIC
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_modify ON suppliers
  FOR ALL TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Accounts
DROP POLICY IF EXISTS tenant_isolation_select ON accounts;
DROP POLICY IF EXISTS tenant_isolation_modify ON accounts;
CREATE POLICY tenant_isolation_select ON accounts
  FOR SELECT TO PUBLIC
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_modify ON accounts
  FOR ALL TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Vaults
DROP POLICY IF EXISTS tenant_isolation_select ON vaults;
DROP POLICY IF EXISTS tenant_isolation_modify ON vaults;
CREATE POLICY tenant_isolation_select ON vaults
  FOR SELECT TO PUBLIC
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_modify ON vaults
  FOR ALL TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Invoices
DROP POLICY IF EXISTS tenant_isolation_select ON invoices;
DROP POLICY IF EXISTS tenant_isolation_modify ON invoices;
CREATE POLICY tenant_isolation_select ON invoices
  FOR SELECT TO PUBLIC
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_modify ON invoices
  FOR ALL TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Daily Sales Summaries
DROP POLICY IF EXISTS tenant_isolation_select ON daily_sales_summaries;
DROP POLICY IF EXISTS tenant_isolation_modify ON daily_sales_summaries;
CREATE POLICY tenant_isolation_select ON daily_sales_summaries
  FOR SELECT TO PUBLIC
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_modify ON daily_sales_summaries
  FOR ALL TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Daily Sales Channels (يرث من daily_sales_summaries)
DROP POLICY IF EXISTS tenant_isolation_select ON daily_sales_channels;
DROP POLICY IF EXISTS tenant_isolation_modify ON daily_sales_channels;
CREATE POLICY tenant_isolation_select ON daily_sales_channels
  FOR SELECT TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM daily_sales_summaries dss
      WHERE dss.id = summary_id AND dss.tenant_id = current_tenant_id()
    )
  );
CREATE POLICY tenant_isolation_modify ON daily_sales_channels
  FOR ALL TO PUBLIC
  USING (
    EXISTS (
      SELECT 1 FROM daily_sales_summaries dss
      WHERE dss.id = summary_id AND dss.tenant_id = current_tenant_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM daily_sales_summaries dss
      WHERE dss.id = summary_id AND dss.tenant_id = current_tenant_id()
    )
  );

-- Ledger Entries
DROP POLICY IF EXISTS tenant_isolation_select ON ledger_entries;
DROP POLICY IF EXISTS tenant_isolation_modify ON ledger_entries;
CREATE POLICY tenant_isolation_select ON ledger_entries
  FOR SELECT TO PUBLIC
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_modify ON ledger_entries
  FOR ALL TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Audit Logs
DROP POLICY IF EXISTS tenant_isolation_select ON audit_logs;
DROP POLICY IF EXISTS tenant_isolation_modify ON audit_logs;
CREATE POLICY tenant_isolation_select ON audit_logs
  FOR SELECT TO PUBLIC
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_modify ON audit_logs
  FOR ALL TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- Employees
DROP POLICY IF EXISTS tenant_isolation_select ON employees;
DROP POLICY IF EXISTS tenant_isolation_modify ON employees;
CREATE POLICY tenant_isolation_select ON employees
  FOR SELECT TO PUBLIC
  USING (tenant_id = current_tenant_id());
CREATE POLICY tenant_isolation_modify ON employees
  FOR ALL TO PUBLIC
  USING (tenant_id = current_tenant_id())
  WITH CHECK (tenant_id = current_tenant_id());

-- ── Roles: بيانات عامة (لا RLS) ────────────────────────────
-- جدول الأدوار مشترك بين جميع الـ Tenants — لا يحتاج RLS

-- ── اختبار العزل ────────────────────────────────────────────
-- يُشغَّل بعد إعداد RLS للتحقق:
-- SELECT set_config('app.current_tenant_id', 'TENANT_A_ID', true);
-- SELECT count(*) FROM invoices; -- يجب أن تعيد فواتير Tenant A فقط
-- SELECT set_config('app.current_tenant_id', 'TENANT_B_ID', true);
-- SELECT count(*) FROM invoices; -- يجب أن تعيد فواتير Tenant B فقط
-- SELECT set_config('app.current_tenant_id', '', true);
-- SELECT count(*) FROM invoices; -- يجب أن تعيد 0 (لا شيء بدون tenant context)

-- ── ملاحظة مهمة للإنتاج ─────────────────────────────────────
-- يجب أن تتصل NestJS بـ DATABASE_URL بدور noorix_app (ليس postgres/superuser)
-- حتى تعمل الـ Policies. Superuser يتجاوز RLS تلقائياً.
-- DATABASE_URL=postgresql://noorix_app:PASSWORD@localhost:5432/noorix_db

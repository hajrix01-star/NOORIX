# تطبيق Row Level Security (RLS) على PostgreSQL

**المصدر:** `backend/prisma/rls_setup.sql`  
**السياق:** Nest يحقن `app.current_tenant_id` عبر `TenantPrismaService` — يجب أن تكون سياسات RLS مطبّقة على **قاعدة البيانات الفعلية** (ليست مجرد وجود الملف في Git).

## 1) قبل التشغيل

- خذ **نسخة احتياطية** (`pg_dump` أو نسخة VPS).
- راجع إنشاء دور `noorix_app` في بداية السكربت؛ غيّر كلمة المرور بعد الإنشاء (`ALTER ROLE noorix_app WITH PASSWORD '…'`).
- تأكد أن اتصال التطبيق الإنتاجي يستخدم مستخدماً يمر عبر السياسات (أو نفّذ السياسات على نفس المستخدم الذي يستخدمه Prisma إن كان مختلفاً — راجع فريق التشغيل).

## 2) التطبيق (مثال `psql`)

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/prisma/rls_setup.sql
```

أو من Windows مع مسار مطلق:

```powershell
psql "postgresql://USER:PASS@HOST:5432/DBNAME" -v ON_ERROR_STOP=1 -f "D:\cursor\noorix\backend\prisma\rls_setup.sql"
```

## 3) تحقق سريع

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('invoices', 'ledger_entries', 'companies')
ORDER BY tablename;
```

توقّع `rowsecurity = true` للجداول المفعّلة في السكربت.

## 4) صيانة

- بعد كل **migration** تضيف جداول عمليات متعددة المستأجرين، حدّث `rls_setup.sql` (أو سكربت لاحق) بسياسات مناسبة ثم أعد التطبيق على البيئات.

# حل MaxClientsInSessionMode على Render + Supabase

## المشكلة
```
FATAL: MaxClientsInSessionMode: max clients reached - in Session mode max clients are limited to pool_size
```

## الحل النهائي

### الخطوة 1: استخدام رابط Pooler (Transaction mode)

1. افتح **Supabase Dashboard** → مشروعك
2. **Project Settings** (أيقونة الترس) → **Database**
3. في **Connection string** اختر **URI**
4. انسخ الرابط من **Connection pooling** → **Transaction** (وليس Direct أو Session)

الشكل الصحيح:
```
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

⚠️ المنفذ يجب أن يكون **6543** (Transaction) وليس 5432 (Session).

### الخطوة 2: تحديث Render

1. Render Dashboard → خدمة الـ Backend
2. **Environment** → عدّل `DATABASE_URL` بالرابط من الخطوة 1
3. أضف `?sslmode=require` إذا لم يكن موجوداً
4. (اختياري) أضف `DATABASE_CONNECTION_LIMIT=2` لمزيد من التقليل

### الخطوة 3: إعادة النشر

**Manual Deploy** → **Deploy latest commit**

---

## ما يُطبّق تلقائياً في الكود

- إذا كان الرابط من Pooler ومنفذ 5432 → يُحوّل إلى 6543
- يُضاف `connection_limit` (افتراضي 2 للـ Pooler، 1 للـ Direct)
- يُضاف `sslmode=require` و `pgbouncer=true` للـ Pooler

## إن استمر الخطأ

تأكد أن الرابط في Render:
1. يحتوي `pooler.supabase.com` (وليس `db.xxx.supabase.co`)
2. المنفذ 6543 ظاهر في الرابط

# خطة نشر نويركس على Railway — من الصفر

## المرحلة 1: حذف المشروع القديم

1. ادخل إلى [Railway Dashboard](https://railway.app/dashboard)
2. افتح المشروع **NOORIX**
3. **Settings** → **Danger Zone** → **Delete Project**
4. أكد الحذف

---

## المرحلة 2: إنشاء مشروع جديد

### الخطوة 2.1: مشروع جديد

1. **New Project**
2. اختر **Deploy from GitHub repo**
3. اختر المستودع **hajrix01-star/NOORIX**
4. اختر الفرع **main**

### الخطوة 2.2: إعداد الخدمة (Backend)

1. بعد إنشاء المشروع، ستظهر خدمة واحدة
2. اضغط على الخدمة → **Settings**

#### Root Directory
- **Root Directory:** `backend`
- هذا يجعل Railway يبني من مجلد backend فقط

#### أو (بدون Root Directory)
- اترك Root Directory **فارغاً**
- سيُستخدم `railway.json` في جذر المشروع (يحتوي على `cd backend`)

### الخطوة 2.3: قاعدة البيانات (Supabase)

1. في Supabase Dashboard → **Project Settings** → **Database**
2. انسخ **Connection string** (URI)
3. تأكد أن الرابط ينتهي بـ `?sslmode=require` أو أضفه يدوياً

مثال:
```
postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres?sslmode=require
```

---

## المرحلة 3: متغيرات البيئة

في Railway → **Variables** → **+ New Variable**

| المتغير | القيمة | إلزامي |
|---------|--------|--------|
| `DATABASE_URL` | رابط Supabase (مع ?sslmode=require) | ✅ |
| `JWT_SECRET` | مفتاح سري 32 حرفاً (مثال: `n8Kp2mQx7vL9wR4tY6uI0oP3aS5dF1gH`) | ✅ |
| `GEMINI_API_KEY` | مفتاح Gemini (للمحادثة الذكية) | ❌ |

**ملاحظة:** لا تضف `PORT` — Railway يضيفه تلقائياً.

**لا تضف** `APP_SKIP_SEED` — نريد تشغيل الـ Seed في النشر الجديد.

---

## المرحلة 4: اختيار طريقة البناء

### الخيار أ: Dockerfile (موصى به — استقرار أعلى)

1. **Settings** → **Build**
2. **Root Directory:** `backend`
3. **Builder:** اختر **Dockerfile**
4. **Dockerfile Path:** `Dockerfile` (داخل backend)
5. اترك Build Command و Start Command فارغين

### الخيار ب: Railpack (الافتراضي)

1. **Root Directory:** `backend`
2. اترك الإعدادات الافتراضية
3. سيُستخدم `backend/railway.json` تلقائياً

---

## المرحلة 5: النطاق (Domain)

1. **Settings** → **Networking** → **Generate Domain**
2. انسخ الرابط (مثل `noorix-production.up.railway.app`)

---

## المرحلة 6: النشر

1. **Deploy** → سيبدأ البناء تلقائياً
2. انتظر اكتمال البناء (1–3 دقائق)
3. تحقق من **Deploy Logs** — يجب أن تظهر:
   - `بدء التطبيق — PORT=... DATABASE_URL=✓`
   - `اتصال قاعدة البيانات نجح`
   - `Noorix Backend يعمل على المنفذ ...`

---

## المرحلة 7: التحقق

### 7.1 فحص Health
```
https://YOUR-DOMAIN.up.railway.app/api/v1/health
```
يجب أن ترجع: `{"status":"ok","dbConnected":true,"adminExists":true,...}`

### 7.2 تسجيل الدخول
- **الرابط:** `https://YOUR-DOMAIN.up.railway.app/login`
- **البريد:** `admin@noorix.sa`
- **كلمة المرور:** `123`

---

## استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| `prisma: not found` | تأكد أن `prisma` في `dependencies` (ليس devDependencies) |
| `فشل اتصال قاعدة البيانات` | تحقق من DATABASE_URL و ?sslmode=require |
| `Application failed to respond` | راجع Deploy Logs — قد يكون خطأ في البدء |
| `Invalid credentials` | تأكد أن الـ Seed يعمل — راجع health: adminExists |

---

## ملخص الملفات المهمة

| الملف | الغرض |
|-------|--------|
| `railway.json` | إعداد البناء والبدء (عند Root = مشروع) |
| `backend/railway.json` | إعداد البناء والبدء (عند Root = backend) |
| `backend/Dockerfile` | بناء عبر Docker (بديل) |
